import { readFileSync } from 'fs'

export function parseNBSFile(filepath: string): number[] {
  const nodeBuffer = readFileSync(filepath)
  const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength)
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
  const songTickLength = short()

  console.log('NBS version:', NBSVersion)
  console.log('Vanilla intrument count.', vanillaInstrumentCount)
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
  console.log('Auto save:', autoSave == 1)

  const autoSaveDuration = byte()
  console.log('Auto save duration:', autoSaveDuration)

  const timeSignature = byte()
  console.log('Time signature:', `${timeSignature}/4`)

  const minutesSpent = integer()
  console.log('Minutes spent:', minutesSpent)

  const leftClicks = integer()
  console.log('Left clicks:', leftClicks)

  const rightClicks = integer()
  console.log('Right clicks:', rightClicks)

  const blocksAdded = integer()
  console.log('Blocks added:', blocksAdded)

  const blocksRemoved = integer()
  console.log('Blocks removed:', blocksRemoved)

  const midi = readString()
  console.log('Midi:', midi)

  const loop = byte()
  console.log('Loop:', loop == 1)

  const maxLoops = byte()
  console.log('Max loops:', maxLoops == 0 ? 'Infinite' : maxLoops)

  const loopStartTick = short()
  console.log('Loop start tick:', loopStartTick)

  console.log('--- Second section')

  // section 2
  let currentTick = -1

  interface Note {
    value: number
  }

  const notes: (Note | undefined)[] = Array(songTickLength).fill(undefined)

  function noteNameFromRawNoteBlockValue(value: number) {
    const v = value - 33

    const f = (n: number) => {
      let a = n % 12
      switch (a) {
        case 0:
          return 'F#'
        case 1:
          return 'G'
        case 2:
          return 'G#'
        case 3:
          return 'A'
        case 4:
          return 'A#'
        case 5:
          return 'B'
        case 6:
          return 'C'
        case 7:
          return 'C#'
        case 8:
          return 'D'
        case 9:
          return 'D#'
        case 10:
          return 'E'
        case 11:
          return 'F'
        default:
          throw 'invalid value'
      }
    }

    return f(v)
  }

  let lowestValue = undefined
  let highestValue = undefined

  while (true) {
    console.log('----------> loop')

    const jumpTicks = short()
    console.log('Jump ticks:', jumpTicks)

    if (jumpTicks === 0) {
      console.log('end of section')
      break
    }
    currentTick += jumpTicks
    console.log('(Current tick):', currentTick)

    let layer = -1
    while (true) {
      const layerJumps = short()
      if (layerJumps === 0) {
        console.log('end of layer')
        break
      }
      layer += layerJumps

      console.log('Layer:', layer, '(+' + layerJumps + ')')

      // debug
      if (layer !== 0) {
        console.warn('only support 1 layer so far, skipping...')
        continue
      }

      const noteBlockIntstrument = byte()
      const noteBlockKey = byte()
      const noteBlockVelocity = byte()
      const noteBlockPanning = ubyte()
      const noteBlockPitch = short()

      if (lowestValue === undefined || noteBlockKey < lowestValue) {
        lowestValue = noteBlockKey
      }

      if (highestValue === undefined || noteBlockKey > highestValue) {
        highestValue = noteBlockKey
      }

      console.log('Instrument:', noteBlockIntstrument)
      console.log('Key:', noteNameFromRawNoteBlockValue(noteBlockKey), '(', noteBlockKey - 33, '| raw:', noteBlockKey, ')')
      console.log('Volume:', noteBlockVelocity, '%')
      console.log('Panning:', noteBlockPanning / 200)
      console.log('Pitch:', noteBlockPitch)

      notes[currentTick] = {
        value: noteBlockKey,
      }
    }
  }

  if (lowestValue === undefined) {
    lowestValue = 0
  }
  if (highestValue === undefined) {
    highestValue = 0
  }

  console.log()
  console.log('Lowest value:', lowestValue - 33)
  console.log('Highest value:', highestValue - 33)
  console.log('Range:', highestValue - lowestValue + 1)
  const uniqueNotes = [...new Set(notes.map(n => n?.value ?? 0).filter(n => n > 0))]
  console.log('Unique notes:', uniqueNotes.length)

  if (uniqueNotes.length > 15) {
    console.error('Too many unique notes:', uniqueNotes.length)
    throw 'too many unique notes'
  }

  console.log('--- ignoring other sections')
  console.log()

  let output: string = '| '
  for (const [index, note] of notes.entries()) {
    if (note === undefined) {
      output += '--'
    } else {
      output += noteNameFromRawNoteBlockValue(note.value).padEnd(2, ' ')
    }
    output += ' | '
    if ((index + 1) % 8 === 0) {
      output += '\n| '
    }
  }
  console.log('notes:')
  console.log(output)

  const trimmedNoteValues = notes.map(x => (x ? x.value - 33 - (lowestValue - 33) + 1 : 0))

  console.log('trimmedNoteValues:', trimmedNoteValues)

  return trimmedNoteValues
}
