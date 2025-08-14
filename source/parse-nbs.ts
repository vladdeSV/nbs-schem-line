import { fromArrayBuffer, type Song } from '@nbsjs/core'

export type { InstrumentId, Note, NoteId, Stream }

export function parseNBSFile(buffer: Buffer): Record<InstrumentId, Record<NoteId, Stream>> {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  const song = fromArrayBuffer(arrayBuffer)
  const streams = convertNBStoStreams(song)
  return streams
}

type InstrumentId = number
type NoteId = number
type Stream = boolean[]

interface Note {
  value: number
  instrument: number
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
        console.warn(`encountered custom instrument (id: ${note.instrument}), skipping`)
        continue
      }

      const shiftedNoteValue = note.key - 33

      if (shiftedNoteValue < 0 || shiftedNoteValue > 24) {
        console.error('invalid note value', note.key, '; expected to be between', 33, '-', 57, ' (0-24 shifted)')
        process.exit(1)
      }

      if (!streams[note.instrument]) {
        streams[note.instrument] = {}
        for (let i = 0; i < 25; ++i) {
          streams[note.instrument][i] = new Array(songTickLength).fill(false)
        }
      }

      streams[note.instrument][shiftedNoteValue][tick] = true
    }
  }

  // remove empty streams
  for (const [instrumentIdAsString, notes] of Object.entries(streams)) {
    const instrument: InstrumentId = Number(instrumentIdAsString)
    for (const [noteValueAsString, stream] of Object.entries(notes)) {
      const note: NoteId = Number(noteValueAsString)
      if (stream.every(x => x === false)) {
        delete streams[instrument][note]
      }
    }
  }

  return streams
}
