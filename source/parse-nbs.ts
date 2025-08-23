import { fromArrayBuffer, Note as NBSNote, type Song, Song as SongClass } from '@nbsjs/core'

export type { InstrumentId, Note, NoteId, Stream }

export function parseNBSFile(buffer: Buffer): Record<InstrumentId, Record<NoteId, Stream>> {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  const song = fromArrayBuffer(arrayBuffer)
  const adjustedSong = validateAndAdjustSong(song)
  const streams = convertNBStoStreams(adjustedSong)
  return streams
}

type InstrumentId = number
type NoteId = number
type Stream = boolean[]

interface Note {
  value: number
  instrument: number
}

const intrumentMinValue = 33
const instrumentMaxValue = 57

function validateAndAdjustSong(song: Song): Song {
  const outOfRangeNotes = song.layers.all.some(layer =>
    Object.values(layer.notes.all).some((note: any) =>
      note.key < intrumentMinValue || note.key > instrumentMaxValue
    )
  )

  const hasCustomInstruments = song.layers.all.some(layer =>
    Object.values(layer.notes.all).some((note: any) => note.instrument > 15)
  )

  const hasIllegalTempo = song.getTempo() !== 20

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

  return createAdjustedSong(song)
}

function getRoundedTempo(originalTempo: number): number {
  if (originalTempo >= 20) {
    return 20 * 2 ** Math.floor((Math.log2(originalTempo / 20)))  // MATH
  }

  if (originalTempo >= 17) {
    return 20
  }

  const factors = [1, 2.22, 2.5, 2.85, 3.33, 4, 5, 6.66, 10]
  let closestFactor = factors.reduce((prev, curr) => {
    return Math.abs(curr - originalTempo) < Math.abs(prev - originalTempo) ? curr : prev
  })
  return closestFactor
}

function createAdjustedSong(originalSong: Song): Song {
  const adjustedSong = new SongClass()

  // copy metadata
  adjustedSong.name = originalSong.name
  adjustedSong.author = originalSong.author
  adjustedSong.originalAuthor = originalSong.originalAuthor
  adjustedSong.description = originalSong.description
  adjustedSong.timeSignature = originalSong.timeSignature
  adjustedSong.setTempo(20)

  const originalTempo = originalSong.getTempo()
  // TODO: implement optional override (don't allow if over 20?)
  const roundedTempo = getRoundedTempo(originalTempo)
  const tempoDelta = (20 / roundedTempo) - 1
  const compressionFactor =  roundedTempo / 20
  console.debug('roundedTempo:', roundedTempo)
  console.debug('tempoDelta:', tempoDelta)
  console.debug('compressionFactor:', compressionFactor)

  // process each layer
  for (const originalLayer of originalSong.layers.all) {
    const adjustedLayer = adjustedSong.layers.create()
    adjustedLayer.name = originalLayer.name
    adjustedLayer.volume = originalLayer.volume
    adjustedLayer.stereo = originalLayer.stereo
    adjustedLayer.isLocked = originalLayer.isLocked
    adjustedLayer.isSolo = originalLayer.isSolo

    // process each note in the layer
    for (const [tickString, note] of Object.entries(originalLayer.notes.all) as [string, any][]) {
      const tick = Number(tickString)

      // skip if compressing and not on a relevant tick
      if (compressionFactor > 1 && tick % compressionFactor != 0) {
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
      const adjustedTick = compressionFactor > 1 ? tick / compressionFactor : Math.floor(tick + tick * tempoDelta)

      // add adjusted note to the layer
      const adjustedNote = new NBSNote(note.instrument, {
        key: adjustedKey,
        velocity: note.velocity,
        panning: note.panning,
        pitch: note.pitch
      })
      adjustedLayer.notes.add(adjustedTick, adjustedNote)
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
    for (const note of Object.values(layer.notes.all) as any[]) {
      if (note.instrument <= 15) { // only vanilla instruments
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
    for (const [tickString, note] of Object.entries(layer.notes.all) as [string, any][]) {
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
    if (isNaN(instrument)) {
      console.warn(`invalid instrument id: ${instrumentIdAsString}, removing`)
      delete streams[instrumentIdAsString as any]
      continue
    }
    if (notes && streams[instrument]) {
      for (const [noteValueAsString, stream] of Object.entries(notes)) {
        const note: NoteId = Number(noteValueAsString)
        if (stream && stream.every(x => x === false)) {
          delete streams[instrument][note]
        }
      }
    }
  }

  return streams
}
