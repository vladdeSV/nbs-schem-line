import { readFileSync } from 'fs'

export function parseNBSFile(filepath: string): Record<string, boolean[]> {
  interface Note {
    value: number
    instrument: number
  }

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

  const notes: Array<(Note | undefined)[]> = new Array(layerCount)
  for (let i = 0; i < layerCount; ++i) {
    notes[i] = Array(songTickLength)
  }
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

      if (lowestValue === undefined || noteBlockKey < lowestValue) {
        lowestValue = noteBlockKey
      }

      if (highestValue === undefined || noteBlockKey > highestValue) {
        highestValue = noteBlockKey
      }

      // console.log('Instrument:', noteBlockIntstrument)
      // console.log(
      //   'Key:',
      //   noteNameFromRawNoteBlockValue(noteBlockKey),
      //   '(',
      //   noteBlockKey - 33,
      //   '| raw:',
      //   noteBlockKey,
      //   ')'
      // )
      // console.log('Volume:', noteBlockVelocity, '%')
      // console.log('Panning:', noteBlockPanning / 200)
      // console.log('Pitch:', noteBlockPitch)

      notes[layer][currentTick] = {
        value: noteBlockKey,
        instrument: noteBlockIntstrument,
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

  const allNoteIntstruments = notes
    .map(layer =>
      layer.map(n => (n !== undefined ? `v:${n.value}/i:${n.instrument}` : undefined)).filter(x => x !== undefined)
    )
    .flat()

  const uniqueNotes = [...new Set(allNoteIntstruments)]

  console.log('Unique notes:', uniqueNotes.length)

  console.log('--- ignoring other sections')
  console.log()

  function todo_noteToWeirdString(note: Note): string {
    return `v:${note.value}/i:${note.instrument}`
  }
  function todo_noteValueFromWeirdString(s: string): number {
    return Number(s.split('/i:')[0].replace('v:', ''))
  }

  const map: Record<string, boolean[]> = {}
  for (const un of uniqueNotes) {
    map[un] = new Array(songTickLength).fill(false)
  }

  for (let x = 0; x < songTickLength; ++x) {
    for (let y = 0; y < layerCount; ++y) {
      const note = notes[y][x]
      if (note === undefined) {
        continue
      }

      const noteString = todo_noteToWeirdString(note)
      map[noteString][x] = true
    }
  }

  // sort map keys
  const sortedKeys = Object.keys(map).sort((a, b) => {
    const aValue = todo_noteValueFromWeirdString(a)
    const bValue = todo_noteValueFromWeirdString(b)
    return aValue - bValue
  })
  const sortedMap: Record<string, boolean[]> = {}
  for (const key of sortedKeys) {
    sortedMap[key] = map[key]
  }
  // replace map with sortedMap
  for (const key of Object.keys(map)) {
    delete map[key]
  }
  for (const key of Object.keys(sortedMap)) {
    map[key] = sortedMap[key]
  }

  // convert boolean arrays in map into binary string
  for (const [key, value] of Object.entries(map)) {
    console.log(key, '\t', value.map(x => (x ? 'X' : '.')).join(''))
  }
  console.log()

  return map
}

/*

  // convert boolean arrays in map into binary string
  for (const [key, value] of Object.entries(map)) {
    let binaryString = ''
    for (const [index, bit] of value.entries()) {
      binaryString += bit ? '1' : '0'
      if (index % 4 === 3) {
        binaryString += ' '
      }
    }

    console.log(key, '\t', binaryString)
  }
*/
