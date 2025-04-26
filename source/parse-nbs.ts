import { readFileSync } from 'node:fs'

export type { InstrumentId, Note, NoteId, Stream }

export function parseNBSFile(filepath: string): Record<InstrumentId, Record<NoteId, Stream>> {
  const nodeBuffer = readFileSync(filepath)
  const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength)

  const layers = createNoteLayers(arrayBuffer)
  const streams = convertNoteLayersToBinaryStreams(layers)
  return streams
}

type InstrumentId = number
type NoteId = number
type Stream = boolean[]

interface Note {
  value: number
  instrument: number
}

function createNoteLayers(arrayBuffer: ArrayBuffer | SharedArrayBuffer): (Note | undefined)[][] {
  const view = new DataView(arrayBuffer)

  let offset = 0

  function byte(): number {
    const value = view.getInt8(offset)
    offset += 1
    return value
  }

  function ubyte(): number {
    const value = view.getUint8(offset)
    offset += 1
    return value
  }

  function short(): number {
    const value = view.getInt16(offset, true)
    offset += 2
    return value
  }

  function integer(): number {
    const value = view.getInt32(offset, true)
    offset += 4
    return value
  }

  function u32(): number {
    const value = view.getUint32(offset, true)
    offset += 4
    return value
  }

  function readString(): string {
    const length = u32()
    const foo = arrayBuffer.slice(offset, offset + length)
    const value = new TextDecoder().decode(new Uint8Array(foo))
    offset += value.length
    return value
  }

  if (short() !== 0) {
    console.error('NOT COMPATIBLE!!')
    process.exit(1)
  }

  const NBSVersion = byte()
  const vanillaInstrumentCount = byte()
  const songTickLength = short() + 1

  console.log('NBS version:', NBSVersion)
  console.log('Vanilla intrument count:', vanillaInstrumentCount)
  console.log('Song tick length:', songTickLength)

  const layerCount = short()
  console.log('Layer count:', layerCount)

  const songName = readString()
  console.log('Name:', songName)

  const author = readString()
  console.log('Author:', author)

  const originalAuthor = readString()
  console.log('Original author:', originalAuthor)

  const description = readString()
  console.log('Description:', description)

  const tempo = short()
  console.log('Tempo:', tempo)

  const autoSave = byte()
  // console.log('Auto save:', autoSave == 1)

  const autoSaveDuration = byte()
  // console.log('Auto save duration:', autoSaveDuration)

  const timeSignature = byte()
  console.log('Time signature:', `${timeSignature}/4`)

  const minutesSpent = integer()
  // console.log('Minutes spent:', minutesSpent)

  const leftClicks = integer()
  // console.log('Left clicks:', leftClicks)

  const rightClicks = integer()
  // console.log('Right clicks:', rightClicks)

  const blocksAdded = integer()
  // console.log('Blocks added:', blocksAdded)

  const blocksRemoved = integer()
  // console.log('Blocks removed:', blocksRemoved)

  const midi = readString()
  // console.log('Midi:', midi)

  const loop = byte()
  // console.log('Loop:', loop == 1)

  const maxLoops = byte()
  // console.log('Max loops:', maxLoops == 0 ? 'Infinite' : maxLoops)

  const loopStartTick = short()
  // console.log('Loop start tick:', loopStartTick)

  // section 2
  console.log()
  console.log('--- Second section')

  let currentTick = -1

  const layers: (Note | undefined)[][] = new Array(layerCount)
  for (let i = 0; i < layerCount; ++i) {
    layers[i] = new Array(songTickLength)
  }

  while (true) {
    // console.log('----------> loop')

    const jumpTicks = short()
    // console.log('Jump ticks:', jumpTicks)

    if (jumpTicks === 0) {
      console.log('end of section')
      break
    }
    currentTick += jumpTicks
    // console.log('(Current tick):', currentTick)

    let layer = -1
    while (true) {
      const layerJumps = short()
      if (layerJumps === 0) {
        // console.log('end of layer')
        break
      }
      layer += layerJumps

      // console.log('Layer:', layer, '(+' + layerJumps + ')')

      const noteBlockIntstrument = byte()
      const noteBlockKey = byte()
      const noteBlockVelocity = byte()
      const noteBlockPanning = ubyte()
      const noteBlockPitch = short()

      if (noteBlockIntstrument > 15) {
        console.warn(`encountered custom instrument (id: ${noteBlockIntstrument}), skipping`)
        continue
      }

      layers[layer][currentTick] = {
        value: noteBlockKey,
        instrument: noteBlockIntstrument,
      }
    }
  }
  return layers
}

function convertNoteLayersToBinaryStreams(
  layers: (Note | undefined)[][],
): Record<InstrumentId, Record<NoteId, Stream>> {
  // get all instruments
  const instruments = new Set<InstrumentId>()
  for (const layer of layers) {
    for (const note of layer) {
      if (note === undefined) {
        continue
      }

      instruments.add(note.instrument)
    }
  }

  const songTickLength = layers[0]?.length ?? 0

  // create sorted keys for each instrument, later to be used
  const streams: Record<InstrumentId, Record<NoteId, Stream>> = {}
  for (const instrument of [...instruments].sort()) {
    streams[instrument] = {}
    // loop all 25 note values
    for (let i = 0; i < 25; ++i) {
      streams[instrument][i] = new Array(songTickLength).fill(false)
    }
  }

  for (const layer of layers) {
    for (const [index, note] of layer.entries()) {
      if (note === undefined) {
        continue
      }

      const shiftedNoteValue = note.value - 33

      if (shiftedNoteValue < 0 || shiftedNoteValue > 24) {
        console.error('invalid note value', note.value, '; expected to be between', 0, '-', 24, ' (33-57)')
        process.exit(1)
      }

      streams[note.instrument][shiftedNoteValue][index] = true
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

  /*
  for (const [instrument, stream] of Object.entries(streams)) {
    if (stream === undefined) {
      console.error('instrument not found:', instrument)
      process.exit(1)
    }

    console.log('# instrument', instrument)

    for (const [note, bools] of Object.entries(stream)) {
      const s = bools.map(x => (x ? 'X' : '-')).join('')
      console.log(`${note}:\t${s}`)
    }
    console.log()
  }
    */

  return streams
}
