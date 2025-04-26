import { Int16, Int32, Int8, read, write } from 'nbtify'
import { readFileSync } from 'node:fs'
import type { InstrumentId, NoteId } from './parse-nbs'
import type { GrayCodeStream } from './process-binary-stream'

interface Schem {
  Schematic: WorldEditSchematic
}

interface WorldEditSchematic {
  Version: Int32
  DataVersion: Int32
  Metadata?: { Date: number; WorldEdit: unknown[] }
  Width: Int16
  Height: Int16
  Length: Int16
  Offset: Int32Array
  Blocks: {
    Palette: BlockPalette
    Data: Int8Array
    BlockEntities: BlockEntity[]
  }
}

interface BlockPalette {
  [key: string]: Int32
}

interface BlockEntity {
  Id: string
  Pos: Int32Array
  Data: {
    id: string
    Items: BlockEntityData[]
  }
}

interface BlockEntityData {
  id: string
  count: Int32
  Slot: Int8
  components?: Record<string, ItemComponent[]>
}

interface ItemComponent {
  slot: Int32
  item: {
    id: string
    count: Int32
  }
}

// function blockIndexAtPositionXZY<T>(blocks: T[], x: number, z: number, y: number): T {
//   return blocks[y * hack.Height * hack.Length + z * hack.Width + x]
// }

/// provided a size of the region, return the "3d position" (index) of the block id array
function createAccessIndexFunctionXZY(w: number, d: number, h: number): (x: number, z: number, y: number) => number {
  return (x: number, z: number, y: number): number => {
    const result = x + w * z + y * w * d

    if (result < 0 || result >= w * d * h) {
      throw `accessing "out-of-bounds": ${result} (${x}, ${z}, ${y} in ${w}×${d}×${h})`
    }

    return result
  }
}

const grayCodeToDiscName = {
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
} as const

const woolBlockIds = [
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
] as const

const instrumentBlockIds = [
  'minecraft:dirt', // piano
  'minecraft:oak_planks', // double bass
  'minecraft:stone', // bass drum
  'minecraft:sand', // snare drum
  'minecraft:glass', // click
  'minecraft:white_wool', // guitar
  'minecraft:clay', // flute
  'minecraft:gold_block', // bell
  'minecraft:packed_ice', // chime
  'minecraft:bone_block', // xylophone
  'minecraft:iron_block', // iron xylophone
  'minecraft:soul_sand', // cow bell
  'minecraft:pumpkin', // didgeridoo
  'minecraft:emerald_block', // bit
  'minecraft:hay_block', // banjo
  'minecraft:glowstone', // pling
] as const

export async function parseInstrumentStreams(
  input: Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>>,
): Promise<Uint8Array> {
  const instrumentIdsOrdered = Object.keys(input)
    .map(Number)
    .sort((a, b) => a - b)

  console.log(instrumentIdsOrdered)

  // 25 instruments × 2 lanes per instrument × 2 chests (double chest) per lane + 1 instrument display block
  const width = 25 * 2 * 2 + 1
  // 1 row of double chests × instruments
  const height = instrumentIdsOrdered.length
  // (only single row for now)
  const depth = 1

  const coordinateToIndexXZY = createAccessIndexFunctionXZY(width, depth, height)

  function heightFromInstrument(instrumentId: InstrumentId): number {
    const y = instrumentIdsOrdered.findIndex(n => n === instrumentId)

    // will go out of bounds
    if (y === -1 || y >= height) {
      console.warn('attempted to access', instrumentId, 'which does not exist in', instrumentIdsOrdered.join(', '))
      return height - 1
    }

    return y
  }

  // create the palette
  const palette: BlockPalette = {}
  for (const [instrumentId, blockName] of Object.entries(instrumentBlockIds)) {
    palette[blockName] = new Int32(Number(instrumentId))
  }

  const customPaletteBlockIds = {
    leftChest: 100,
    rightChest: 101,
    noteNotUsedBlockId: 102, // note does not exist at all
    singleStreamMissingBlockId: 103, // missing one of the two double chests
  }

  palette['minecraft:chest[facing=south,type=right,waterlogged=false]'] = new Int32(customPaletteBlockIds.leftChest)
  palette['minecraft:chest[facing=south,type=left,waterlogged=false]'] = new Int32(customPaletteBlockIds.rightChest)
  palette['minecraft:coal_block'] = new Int32(customPaletteBlockIds.noteNotUsedBlockId)
  palette['minecraft:quartz_block'] = new Int32(customPaletteBlockIds.singleStreamMissingBlockId)

  const blockIds: number[] = new Array(width * height * depth).fill(customPaletteBlockIds.noteNotUsedBlockId)
  for (let i = 0; i < height; i++) {
    const blockIndex = coordinateToIndexXZY(0, 0, i)
    const instrumentId = instrumentIdsOrdered[i]

    blockIds[blockIndex] = instrumentId
  }

  const blockEntities: BlockEntity[] = []

  for (const [instrumentIdAsString, notes] of Object.entries(input)) {
    for (const [noteIdAsString, [stream1, stream2]] of Object.entries(notes)) {
      const instrumentId: InstrumentId = Number(instrumentIdAsString)
      const noteId: NoteId = Number(noteIdAsString)

      function createDoubleChestsInGlobalData(startX: number, y: number, stream: GrayCodeStream) {
        const doubleChestStartIndex = coordinateToIndexXZY(startX, 0, y)
        if (!stream.every(v => v === 0)) {
          blockIds[doubleChestStartIndex] = customPaletteBlockIds.leftChest
          blockIds[doubleChestStartIndex + 1] = customPaletteBlockIds.rightChest

          function createBlockEntityFromData(x: number, y: number, contents: BlockEntityData[]): BlockEntity {
            return {
              Id: 'minecraft:chest',
              Pos: new Int32Array([x, y, 0]),
              Data: {
                id: 'minecraft:chest',
                Items: contents,
              },
            }
          }

          // create block entity data
          const [contentsLeft, contentsRight] = streamToDoubleChestContents(stream)

          if (contentsLeft.length) {
            const blockEntity = createBlockEntityFromData(startX, y, contentsLeft)
            blockEntities.push(blockEntity)
          }

          if (contentsRight?.length) {
            const blockEntity = createBlockEntityFromData(startX + 1, y, contentsRight)
            blockEntities.push(blockEntity)
          }
        } else {
          blockIds[doubleChestStartIndex] = customPaletteBlockIds.singleStreamMissingBlockId
          blockIds[doubleChestStartIndex + 1] = customPaletteBlockIds.singleStreamMissingBlockId
        }
      }

      // set chest block ids in data array
      const y = heightFromInstrument(instrumentId)
      const startX = 1 + noteId * 4

      createDoubleChestsInGlobalData(startX, y, stream1)
      createDoubleChestsInGlobalData(startX + 2, y, stream2)
    }
  }

  const data: WorldEditSchematic = {
    // worldedit defaults
    Version: new Int32(3),
    DataVersion: new Int32(4189),

    Width: new Int16(width),
    Height: new Int16(height),
    Length: new Int16(depth),

    // simple offset
    Offset: new Int32Array([1, 0, 0]),

    // the actual data
    Blocks: {
      Palette: palette,
      Data: new Int8Array(blockIds),
      BlockEntities: blockEntities,
    },
  }

  const schem = await read(readFileSync('./resource/base.schem'))
  ;(schem.data as any).Schematic = data

  return await write(schem)
}

type TruthyGrayValue = keyof typeof grayCodeToDiscName
function isNumberSupportedGrayCode(value: unknown): value is TruthyGrayValue {
  if (typeof value !== 'number') {
    return false
  }

  if (value !== Math.floor(value)) {
    throw `gray code is not an integer: ${value}`
  }

  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
      return true
    default:
      return false
  }
}

type ItemSlotRepresentation =
  | {
      type: 'disc'
      gray: TruthyGrayValue
    }
  | {
      type: 'pause'
      count: number
    }

function streamToItemRepresentation(stream: GrayCodeStream): ItemSlotRepresentation[] {
  const itemSlots: ItemSlotRepresentation[] = []

  let currentPauseAmount = 0
  for (const value of stream) {
    if (currentPauseAmount > 64) {
      itemSlots.push({ type: 'pause', count: 64 })
      currentPauseAmount -= 64
    }

    if (value === 0) {
      currentPauseAmount++
      continue
    }

    if (!isNumberSupportedGrayCode(value)) {
      throw `unsupported value in conversion from gray -> disc: ${value}`
    }

    if (currentPauseAmount > 0) {
      itemSlots.push({ type: 'pause', count: currentPauseAmount })
      currentPauseAmount = 0
    }

    itemSlots.push({ type: 'disc', gray: value })
  }

  return itemSlots
}

function createShulkerBoxContainerListFromItemRepresentations(items: ItemSlotRepresentation[]): ItemComponent[] {
  if (items.length > 27) {
    console.error('cannot process more than 27 items when converting to shulkers')
    process.exit(1)
  }

  const components: ItemComponent[] = []
  let incrementGoingFromPauseToDisc = 0
  let currentlyIsPause = false

  for (const [index, item] of items.entries()) {
    if (item.type === 'pause') {
      currentlyIsPause = true

      const woolItemName = woolBlockIds[incrementGoingFromPauseToDisc]

      components.push({
        item: {
          id: woolItemName,
          count: new Int32(item.count),
        },
        slot: new Int32(index),
      })

      continue
    }

    if (currentlyIsPause) {
      incrementGoingFromPauseToDisc++
    }

    components.push({
      item: {
        id: grayCodeToDiscName[item.gray],
        count: new Int32(1),
      },
      slot: new Int32(index),
    })
  }

  return components
}

/// ai generated
function chunkArray<T>(source: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new RangeError('Chunk size must be a positive integer.')
  }
  const result: T[][] = []
  for (let i = 0; i < source.length; i += size) {
    result.push(source.slice(i, i + size))
  }
  return result
}

function streamToDoubleChestContents(stream: GrayCodeStream): BlockEntityData[][] {
  const itemRepresentations = streamToItemRepresentation(stream)
  if (itemRepresentations.length === 0) {
    return []
  }

  const itemsPerChest = chunkArray(itemRepresentations, 27 * 27)
  if (itemsPerChest.length > 2) {
    throw 'too many notes; cannot have more than 27 × 27 item slots for a single note & instrument'
  }

  const shulkers: BlockEntityData[][] = []
  for (const itemsInChest of itemsPerChest) {
    if (itemsInChest.length === 0) {
      continue
    }

    const bss = chunkArray(itemsInChest, 27)

    const shulkerItemComponents: ItemComponent[][] = []
    for (const shulkerContainerItems of bss) {
      const c = createShulkerBoxContainerListFromItemRepresentations(shulkerContainerItems)
      shulkerItemComponents.push(c)
    }

    const something: BlockEntityData[] = []
    // create shulker container `'minecraft:container': […]` of b's items
    for (const [index, d] of shulkerItemComponents.entries()) {
      something.push({
        count: new Int32(1),
        Slot: new Int8(index),
        components: {
          'minecraft:container': d,
        },
        id: 'minecraft:shulker_box',
      })
    }

    shulkers.push(something)
  }

  if (shulkers.length > 2) {
    console.error('somehow we created more than 2 double chests worth of contents')
    process.exit(1)
  }

  return shulkers
}
