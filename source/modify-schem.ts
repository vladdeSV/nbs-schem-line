import { readFileSync } from 'fs'
import { Int16, Int32, Int8, read, write, type NBTData } from 'nbtify'
import type { Hm } from './process-binary-stream'

export async function parseNoteValues(noteValues: number[]): Promise<Uint8Array> {
  const uniqueNotes = [...new Set(noteValues)].filter(v => v > 0)

  console.log = () => {}

  function findRedstoneSignalFromNoteValue(noteValue: number): number {
    const index = uniqueNotes.indexOf(noteValue)
    if (index === -1) {
      throw 'note does not exist'
    }

    const value = index + 1

    console.log('findRedstoneSignalFromNoteValue', noteValue, '->', value)

    return value
  }

  console.log('uniqueNotes', uniqueNotes)

  const rawBuffer: Buffer = readFileSync('./resource/base.schem') // assumes we run index.ts in the project root
  const data: NBTData = await read(rawBuffer)

  const hack: {
    Version: number
    DataVersion: number
    Metadata: { Date: number; WorldEdit: unknown[] }
    Width: Int16
    Height: Int16
    Length: Int16
    Offset: Int32Array
    Blocks: { Palette: Record<string, Int32>; Data: Int8Array; BlockEntities: any[] }
  } = (data.data as any).Schematic

  // function blockIndexAtPosition<T>(blocks: T[], x: number, y: number, z: number): T {
  //   return blocks[y * hack.Height * hack.Length + z * hack.Width + x]
  // }

  // function coordinateToBlockIndex(x: number, y: number, z: number): Int32 {
  //   return new Int32(y * hack.Height * hack.Length + z * hack.Width + x)
  // }

  hack.Width = new Int16(noteValues.length)
  hack.Height = new Int16(2)
  hack.Length = new Int16(1)
  hack.Offset = new Int32Array([1, 0, 0])
  hack.Blocks.Palette = {}
  hack.Blocks.Palette['minecraft:air'] = new Int32(0)
  hack.Blocks.Palette[
    'minecraft:chiseled_bookshelf[facing=east,slot_0_occupied=false,slot_1_occupied=false,slot_2_occupied=false,slot_3_occupied=true,slot_4_occupied=false,slot_5_occupied=false]'
  ] = new Int32(1)

  // loop unique notes
  for (let i = 0; i < uniqueNotes.length; i++) {
    const noteValue = uniqueNotes[i]
    hack.Blocks.Palette[`minecraft:note_block[instrument=harp,note=${noteValue},powered=false]`] = new Int32(i + 2)
  }

  hack.Blocks.Data = new Int8Array([
    ...noteValues.map(v => (v > 0 ? 1 : 0)),
    ...Object.keys(uniqueNotes).map(i => Number(i) + 2),
  ])
  hack.Blocks.BlockEntities = []
  for (let i = 0; i < noteValues.length; i++) {
    if (noteValues[i] === 0) {
      continue
    }

    const redstoneSignal = findRedstoneSignalFromNoteValue(noteValues[i])

    hack.Blocks.BlockEntities.push({
      Id: 'minecraft:chiseled_bookshelf',
      Pos: new Int32Array([i, 0, 0]),
      Data: {
        last_interacted_slot: new Int32(redstoneSignal - 1),
        id: 'minecraft:chiseled_bookshelf',
        Items: [
          {
            count: new Int32(1),
            Slot: new Int8(3),
            id: 'minecraft:book',
          },
        ],
      },
    })
  }

  ;(data.data as any).Schematic = hack

  return await write(data)
}

const grayCodeToDiscName: Record<number, string> = {
  0: 'minecraft:wooden_shovel',
  1: 'minecraft:music_disc_13',
  2: 'minecraft:music_disc_cat',
  3: 'minecraft:music_disc_blocks',
  4: 'minecraft:music_disc_chirp',
  5: 'minecraft:music_disc_far',
  6: 'minecraft:music_disc_mall',
  7: 'minecraft:music_disc_mellohi',
  8: 'minecraft:music_disc_stal',
  9: 'minecraft:music_disc_strad',
  10: 'minecraft:music_disc_ward',
  11: 'minecraft:music_disc_11',
  12: 'minecraft:music_disc_wait',
  13: 'minecraft:music_disc_precipice',
  14: 'minecraft:music_disc_otherside',
  15: 'minecraft:music_disc_5',
}

const woolNames: string[] = [
  'minecraft:white_wool',
  'minecraft:orange_wool',
  'minecraft:magenta_wool',
  'minecraft:light_blue_wool',
  'minecraft:yellow_wool',
  'minecraft:lime_wool',
  'minecraft:pink_wool',
  'minecraft:gray_wool',
  'minecraft:light_gray_wool',
  'minecraft:cyan_wool',
  'minecraft:purple_wool',
  'minecraft:blue_wool',
  'minecraft:brown_wool',
  'minecraft:green_wool',
  'minecraft:red_wool',
  'minecraft:black_wool',
]

export async function schem2HardCodedInstrument(notes: Hm[]): Promise<Uint8Array> {
  const rawBuffer: Buffer = readFileSync('./resource/shulker-chests-test.schem') // assumes we run index.ts in the project root
  const data: NBTData = await read(rawBuffer)

  // console.dir(data, { depth: null })

  const hack: {
    Version: number
    DataVersion: number
    Metadata: { Date: number; WorldEdit: unknown[] }
    Width: Int16
    Height: Int16
    Length: Int16
    Offset: Int32Array
    Blocks: { Palette: Record<string, Int32>; Data: Int8Array; BlockEntities: any[] }
  } = (data.data as any).Schematic

  // function blockIndexAtPosition<T>(blocks: T[], x: number, y: number, z: number): T {
  //   return blocks[y * hack.Height * hack.Length + z * hack.Width + x]
  // }

  // function coordinateToBlockIndex(x: number, y: number, z: number): Int32 {
  //   return new Int32(y * hack.Height * hack.Length + z * hack.Width + x)
  // }

  hack.Width = new Int16(notes.length * 4)
  hack.Height = new Int16(2)
  hack.Length = new Int16(1)
  hack.Offset = new Int32Array([1, 0, 0])

  hack.Blocks.BlockEntities = []

  const emptyDoubleChest: boolean[] = Array(500).fill(true)

  for (const [index, dualstream] of notes.entries()) {
    if (dualstream === undefined) {
      continue
    }

    const [first, second] = dualstream

    const a1 = streamOfNumbersToShulkerBoxes(first)
    const b1 = a1
      .filter(x => x.length > 0)
      .map((x, index) => {
        return {
          count: new Int32(1),
          Slot: new Int8(index),
          components: {
            'minecraft:container': x,
          },
          id: 'minecraft:shulker_box',
        }
      })

    if (b1.length) {
      hack.Blocks.BlockEntities.push({
        Id: 'minecraft:chest',
        Pos: new Int32Array([4 * index + 1, 0, 0]),
        Data: {
          id: 'minecraft:chest',
          Items: b1,
        },
      })

      emptyDoubleChest[index * 2] = false
    }

    const a2 = streamOfNumbersToShulkerBoxes(second)
    const b2 = a2
      .filter(x => x.length > 0)
      .map((x, index) => {
        return {
          count: new Int32(1),
          Slot: new Int8(index),
          components: {
            'minecraft:container': x,
          },
          id: 'minecraft:shulker_box',
        }
      })

    if (b2.length) {
      hack.Blocks.BlockEntities.push({
        Id: 'minecraft:chest',
        Pos: new Int32Array([4 * index + 1 + 2, 0, 0]),
        Data: {
          id: 'minecraft:chest',
          Items: b2,
        },
      })
      emptyDoubleChest[index * 2 + 1] = false
    }

    console.log()
  }

  hack.Blocks.Palette = {}
  hack.Blocks.Palette['minecraft:chest[facing=north,type=left,waterlogged=false]'] = new Int32(0)
  hack.Blocks.Palette['minecraft:chest[facing=north,type=right,waterlogged=false]'] = new Int32(1)
  hack.Blocks.Palette['minecraft:stone'] = new Int32(2) // note does not exist at all
  hack.Blocks.Palette['minecraft:oak_planks'] = new Int32(3) // missing one of the two double chests
  hack.Blocks.Data = new Int8Array([
    ...Array.from({ length: 100 }, (_, i) => {
      if (notes[Math.floor(i / 4)] === undefined) {
        return 2
      }

      if (emptyDoubleChest[Math.floor(i / 2)]) {
        return 3
      }

      if (i % 2 === 0) {
        return 0 // left chest id
      } else {
        return 1 // right chest id
      }
    }),
  ])
  ;(data.data as any).Schematic = hack

  // console.dir(data, { depth: undefined })

  return await write(data)
}

interface BlockDataContainer {
  slot: Int32
  item: {
    id: string
    count: Int32
  }
}
function streamOfNumbersToShulkerBoxes(stream: number[]): BlockDataContainer[][] {
  const mutableStream = [...stream]

  if (mutableStream.every(x => x === 0)) {
    console.log('(skipping empty stream)')
    return []
  }

  const allContainers: BlockDataContainer[][] = []

  let currentSlot = 0
  let inventorySlots: BlockDataContainer[] = []

  let incrementOnEmpty = 0
  let incrementOnNewDisc = 0

  console.log('parsing stream', stream.map(x => x || 0).join(','))

  function checkWeDontOverstepSlotLimit() {
    if (currentSlot >= 27) {
      allContainers.push([...inventorySlots])
      inventorySlots = []
      currentSlot = 0
      incrementOnNewDisc = 0
    }
  }

  while (mutableStream.length) {
    checkWeDontOverstepSlotLimit()

    const value = mutableStream.shift()

    if (value === undefined) {
      continue
    }

    if (value === 0) {
      ++incrementOnEmpty

      if (incrementOnEmpty >= 64) {
        inventorySlots.push({
          slot: new Int32(currentSlot),
          item: {
            id: woolNames[incrementOnNewDisc],
            count: new Int32(64),
          },
        })
        ++currentSlot
        incrementOnEmpty -= 64
      }

      continue
    }

    if (incrementOnEmpty > 0) {
      inventorySlots.push({
        slot: new Int32(currentSlot),
        item: {
          id: woolNames[incrementOnNewDisc],
          count: new Int32(incrementOnEmpty),
        },
      })
      ++currentSlot
      ++incrementOnNewDisc
      incrementOnEmpty = 0

      checkWeDontOverstepSlotLimit()
    }

    const discName = grayCodeToDiscName[value]

    inventorySlots.push({
      slot: new Int32(currentSlot),
      item: {
        id: discName,
        count: new Int32(1),
      },
    })
    ++currentSlot
  }

  allContainers.push(inventorySlots)

  return allContainers
}
