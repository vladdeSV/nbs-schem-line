import {
  fromArrayBuffer,
  type Instrument,
  type Layer,
  Note as NBSNote,
  type Song,
  Song as SongClass,
  toArrayBuffer,
} from '@nbsjs/core'

export type { InstrumentId, Note, NoteId, Stream }

export type RoundingMethod = 'approximate' | 'round' | 'flexible' | 'none'
export function parseNBSFile(
  buffer: Uint8Array,
  rounding: RoundingMethod,
): Record<InstrumentId, Record<NoteId, Stream>> {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  const song = fromArrayBuffer(arrayBuffer)
  const adjustedSong = validateAndAdjustSong(song, rounding)
  const streams = convertNBStoStreams(adjustedSong)
  return streams
}

type InstrumentId = number
type NoteId = number
type Tick = number
type Tempo = number
type Stream = boolean[]

interface Note {
  value: number
  instrument: number
}

const intrumentMinValue = 33
const instrumentMaxValue = 57

/*
 * Returns a list of instrument IDs that act as tempo changers (i.e. have the name "Tempo Changer").
 */
function getTempoChangerInstruments(song: Song): InstrumentId[] {
  return Object.values(song.instruments.all as Instrument[]).flatMap((instrument, id) =>
    instrument.name === 'Tempo Changer' ? [id] : [],
  )
}

/*
 * Returns a mapping of tick -> new tempo (in ticks per second) for each tick with a tempo change in the song.
 * If there are multiple tempo changers at the same tick, the one in the highest layer takes precedence.
 * If there is no tempo changer at tick 0, the song's initial tempo is added at tick 0.
 *
 * Tempo changers are identified by their instrument being named "Tempo Changer".
 * The new tempo at that point is determined by the note's pitch: pitch = BPM = (t/s) * 15
 * e.g. a pitch of 150 means the tempo will be set to 15 ticks per second at that point.
 *
 * Negative pitches are allowed and have the same effect as their positive counterparts.
 */
function getTempoSegments(song: Song, tempoChangerInstruments: InstrumentId[]): Record<Tick, Tempo> {
  const tempoSegments: Record<Tick, Tempo> = {}

  if (tempoChangerInstruments.length > 0) {
    for (const layer of song.layers.all.reverse()) {
      for (const [tickStr, note] of Object.entries(layer.notes.all) as [string, NBSNote][]) {
        const tick = parseInt(tickStr, 10)

        // Skip if note is undefined
        if (!note) {
          continue
        }

        // Not a tempo changer
        if (!tempoChangerInstruments.includes(note.instrument)) {
          continue
        }

        // The tempo change isn't effective if there's another tempo changer in the same tick,
        // so we iterate layers bottom to top and skip the block if a tempo changer has already
        // been found in this tick
        if (tick in tempoSegments) {
          continue
        }

        const tempo = Math.abs(note.pitch) / 15 // note pitch = BPM = (t/s) * 15
        tempoSegments[tick] = tempo
      }
    }
  }

  // If there isn't a tempo changer at tick 0, we add one there to set the starting tempo
  tempoSegments[0] = 0 in tempoSegments ? tempoSegments[0] : song.getTempo()

  return tempoSegments
}

/*
 * Generates a tick mapping based on the song's tempo changes.
 * The mapping is an array where the index represents the original tick,
 * and the value at that index represents the adjusted tick after accounting for tempo changes.
 */
function getTickMap(song: Song, tempoSegments: Record<Tick, Tempo>): Tick[] {
  let currentTempo = song.getTempo()
  const tickMap = [0] // tick 0 always maps to tick 0
  const songLength = song.getLength()

  for (let tick = 1; tick <= songLength; ++tick) {
    // check if there's a tempo change at this tick
    if (tick in tempoSegments) {
      currentTempo = tempoSegments[tick]
    }

    const previousMappedTick = tickMap[tick - 1]
    const mappedTick = previousMappedTick + 20 / currentTempo
    tickMap.push(mappedTick)
  }

  return tickMap
}

function validateAndAdjustSong(song: Song, roundingMethod: RoundingMethod): Song {
  const outOfRangeNotes = song.layers.all.some(layer =>
    Object.values(layer.notes.all).some(
      (note: NBSNote) => note.key < intrumentMinValue || note.key > instrumentMaxValue,
    ),
  )

  const hasCustomInstruments = song.layers.all.some(layer =>
    Object.values(layer.notes.all).some((note: NBSNote) => note.instrument > 15),
  )

  const hasIllegalTempo = song.getTempo() !== 20 && roundingMethod !== 'none'

  if (!outOfRangeNotes && !hasCustomInstruments && !hasIllegalTempo) {
    return song
  }

  console.warn('song contains illegal elements:')
  if (hasIllegalTempo) {
    console.warn(`- tempo is ${song.getTempo()} ticks per second (will be adjusted to 20)`)
  }
  if (outOfRangeNotes) {
    console.warn('- notes out of range 33-57 (will be transposed to legal range)')
  }
  if (hasCustomInstruments) {
    console.warn('- custom instruments >15 (will be removed)')
  }
  console.warn('proceeding with adjustments...')

  return createAdjustedSong(song, roundingMethod)
}

function calculateTempoDelta(originalTempo: number, roundingMethod: RoundingMethod): number {
  if (roundingMethod === 'none') {
    return 0
  }

  const roundingCutoff = 0.75

  if (originalTempo <= 20) {
    if (roundingMethod === 'round') {
      return Math.floor(20 / originalTempo + roundingCutoff) - 1
    }

    return 20 / originalTempo - 1
  }

  // force rounding for tempos above 20 no matter what
  return -(2 ** Math.floor(Math.log2(originalTempo / (20 * (1 + roundingCutoff))) + 1)) + 1
}

function createAdjustedSong(originalSong: Song, roundingMethod: RoundingMethod): Song {
  const adjustedSong = new SongClass()

  // copy metadata
  adjustedSong.name = originalSong.name
  adjustedSong.author = originalSong.author
  adjustedSong.originalAuthor = originalSong.originalAuthor
  adjustedSong.description = originalSong.description
  adjustedSong.timeSignature = originalSong.timeSignature

  // okay this is probably overkill, but...
  const tempo = roundingMethod === 'none' ? originalSong.getTempo() : 20
  adjustedSong.setTempo(tempo)

  const originalTempo = originalSong.getTempo()
  const tempoDelta = calculateTempoDelta(originalTempo, roundingMethod)
  const compressionFactor = tempoDelta < 0 ? -tempoDelta + 1 : 0
  console.debug('tempoDelta:', tempoDelta)
  console.debug('compressionFactor:', compressionFactor)

  let tickMap: Tick[] = []
  let maxStackedTicks = 1
  if (roundingMethod === 'flexible') {
    const tempoChangerInstruments = getTempoChangerInstruments(originalSong)
    if (tempoChangerInstruments.length === 0) {
      console.warn('no tempo changer instruments found, falling back to approximate rounding')
      roundingMethod = 'approximate'
    } else {
      console.debug('using flexible rounding with tempo segments')

      const tempoSegments = getTempoSegments(originalSong, tempoChangerInstruments)
      tickMap = getTickMap(originalSong, tempoSegments)

      // Determine maximum number of stacked ticks after tempo changes
      const maxTempo = Math.max(...Object.values(tempoSegments))
      maxStackedTicks = Math.ceil(maxTempo / 20)
    }
  }

  // process each layer
   // Layers are returned bottom to top, so we reverse to process top to bottom
  for (const originalLayer of originalSong.layers.all.toReversed()) {
    console.debug('processing layer:', originalLayer)

    const addedLayers = []
    let adjustedLayer: Layer
    
    for (let i = 1; i <= maxStackedTicks; i++) {
      const newLayer = adjustedSong.layers.create()
      newLayer.name = originalLayer.name
      newLayer.volume = originalLayer.volume
      newLayer.stereo = originalLayer.stereo
      newLayer.isLocked = originalLayer.isLocked
      newLayer.isSolo = originalLayer.isSolo
      addedLayers.push(newLayer)
    }
    // Go back to the first layer we created
    let currentStackedLayer = -1 // will be incremented to 0 on first note
    adjustedLayer = addedLayers[0]
    
    let lastPopulatedTick = 0

    // process each note in the layer
    for (const [tickString, note] of Object.entries(originalLayer.notes.all) as [string, NBSNote][]) {
      const tick = Number(tickString)

      // skip if compressing and not on a relevant tick
      if (roundingMethod !== 'flexible' && compressionFactor > 0 && tick % compressionFactor !== 0) {
        continue
      }

      // skip custom instruments
      if (note.instrument > 15) {
        continue
      }

      // adjust note key to legal range
      let adjustedKey = note.key
      while (adjustedKey < intrumentMinValue) {
        adjustedKey += 12
      }
      while (adjustedKey > instrumentMaxValue) {
        adjustedKey -= 12
      }

      // adjust timing based on tempo change
      let adjustedTick: number
      if (roundingMethod !== 'flexible') {
        adjustedTick = compressionFactor > 0 ? tick / compressionFactor : Math.floor(tick + tick * tempoDelta)
      } else {
        adjustedTick = Math.round(tickMap[tick])

        // if multiple ticks map to the same adjusted tick, we put them in the next available layer
        if (adjustedTick <= lastPopulatedTick) {
          currentStackedLayer += 1
        } else {
          currentStackedLayer = 0
        }
        adjustedLayer = addedLayers[currentStackedLayer]
        if (!adjustedLayer) {
          throw `no layer available for currentStackedLayer ${currentStackedLayer}, maxStackedTicks ${maxStackedTicks}`
        }
      }

      // add adjusted note to the layer
      const adjustedNote = new NBSNote(note.instrument, {
        key: adjustedKey,
        velocity: note.velocity,
        panning: note.panning,
        pitch: note.pitch,
      })
      adjustedLayer.notes.add(adjustedTick, adjustedNote)

      lastPopulatedTick = adjustedTick
    }
  }
  
  return adjustedSong
}

function convertNBStoStreams(song: Song): Record<InstrumentId, Record<NoteId, Stream>> {
  console.debug('nbs version:', song.version)
  console.debug('tick length:', song.getLength())
  console.debug('layer count:', song.layers.all.length)
  console.debug('name:', song.name)
  console.debug('transcription author:', song.author)
  console.debug('original author:', song.originalAuthor)
  console.debug('description:', song.description)
  console.debug('tempo:', song.getTempo())
  console.debug('time signature:', `${song.timeSignature}/4`)

  // get max tick length by finding the highest tick index across all layers
  let songTickLength = 0
  for (const layer of song.layers.all) {
    const noteTicksAsNumbers = Object.keys(layer.notes.all).map(Number)
    if (noteTicksAsNumbers.length > 0) {
      const maxTick = Math.max(...noteTicksAsNumbers)
      songTickLength = Math.max(songTickLength, maxTick)
    }
  }
  songTickLength += 1 // convert from 0-based to length

  // get all instruments
  const instruments = new Set<InstrumentId>()
  for (const layer of song.layers.all) {
    for (const note of Object.values(layer.notes.all) as NBSNote[]) {
      if (note.instrument <= 15) {
        // only vanilla instruments
        instruments.add(note.instrument)
      }
    }
  }

  // create sorted keys for each instrument
  const streams: Record<InstrumentId, Record<NoteId, Stream>> = {}
  for (const instrument of [...instruments].sort()) {
    streams[instrument] = {}
    // loop all 25 note values
    for (let i = 0; i < 25; ++i) {
      streams[instrument][i] = new Array(songTickLength).fill(false)
    }
  }

  // populate streams with notes from all layers
  for (const layer of song.layers.all) {
    for (const [tickString, note] of Object.entries(layer.notes.all) as [string, NBSNote][]) {
      const tick = Number(tickString)

      if (note.instrument > 15) {
        console.debug(`skipping custom instrument (id: ${note.instrument})`)
        continue
      }

      const shiftedNoteValue = note.key - 33

      if (shiftedNoteValue < 0 || shiftedNoteValue > 24) {
        console.warn(`note key ${note.key} out of expected range, skipping`)
        continue
      }

      if (!streams[note.instrument]) {
        streams[note.instrument] = {}
        for (let i = 0; i < 25; ++i) {
          streams[note.instrument][i] = new Array(songTickLength).fill(false)
        }
      }

      if (!streams[note.instrument][shiftedNoteValue]) {
        streams[note.instrument][shiftedNoteValue] = new Array(songTickLength).fill(false)
      }

      if (tick < songTickLength) {
        streams[note.instrument][shiftedNoteValue][tick] = true
      }
    }
  }

  // remove empty streams
  for (const [instrumentIdAsString, notes] of Object.entries(streams)) {
    const instrument: InstrumentId = Number(instrumentIdAsString)
    if (Number.isNaN(instrument)) {
      console.warn(`invalid instrument id: ${instrumentIdAsString}, removing`)
      // biome-ignore lint/suspicious/noExplicitAny: it's supposed to be a number, but if it's not, then wth?
      delete streams[instrumentIdAsString as any]
      continue
    }
    if (notes && streams[instrument]) {
      for (const [noteValueAsString, stream] of Object.entries(notes)) {
        const note: NoteId = Number(noteValueAsString)
        if (stream?.every(x => x === false)) {
          delete streams[instrument][note]
        }
      }
    }
  }

  return streams
}
