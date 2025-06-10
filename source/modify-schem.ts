import { Int16, Int32, Int8, NBTData, write } from 'nbtify'
import { readFileSync } from 'node:fs'
import type { InstrumentId, NoteId } from './parse-nbs'
import type { GrayCodeStream } from './process-binary-stream'

export { findInstrumentPositions, getLocalCoordinates, instrumentBlockIds }

const WALL_DISTANCE = 14 * 4 // <-- debug //130 // distance from the center to the disc reader wall
const VERTICAL_SPACING = 11 // blocks between each row of chests
const GLOBAL_Y_OFFSET = 0 // global y offset for all blocks, for tweaking everything all at once :)

type Direction = 'north' | 'south' | 'east' | 'west'
type Section = 'top' | 'middle' | 'bottom' | 'percussion-left' | 'percussion-right'

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
export type InstrumentName = (typeof instrumentBlockIds)[number]

// Create reverse lookup from block name to instrument ID
const blockNameToInstrumentId = Object.fromEntries(
  instrumentBlockIds.map((blockName, index) => [blockName, index]),
) as Record<string, InstrumentId>

// Mapping: Direction + Section → Instrument ID
const directionSectionToInstrument: Record<Direction, Record<Section, InstrumentId>> = {
  north: {
    top: blockNameToInstrumentId['minecraft:glowstone'],
    middle: blockNameToInstrumentId['minecraft:gold_block'],
    bottom: blockNameToInstrumentId['minecraft:packed_ice'],
    'percussion-left': blockNameToInstrumentId['minecraft:stone'],
    'percussion-right': blockNameToInstrumentId['minecraft:soul_sand'],
  },
  south: {
    top: blockNameToInstrumentId['minecraft:clay'],
    middle: blockNameToInstrumentId['minecraft:iron_block'],
    bottom: blockNameToInstrumentId['minecraft:bone_block'],
    'percussion-left': blockNameToInstrumentId['minecraft:glass'],
    'percussion-right': blockNameToInstrumentId['minecraft:sand'],
  },
  east: {
    top: blockNameToInstrumentId['minecraft:emerald_block'],
    middle: blockNameToInstrumentId['minecraft:pumpkin'],
    bottom: blockNameToInstrumentId['minecraft:hay_block'],
    'percussion-left': blockNameToInstrumentId['minecraft:soul_sand'],
    'percussion-right': blockNameToInstrumentId['minecraft:glass'],
  },
  west: {
    top: blockNameToInstrumentId['minecraft:white_wool'],
    middle: blockNameToInstrumentId['minecraft:oak_planks'],
    bottom: blockNameToInstrumentId['minecraft:dirt'],
    'percussion-left': blockNameToInstrumentId['minecraft:sand'],
    'percussion-right': blockNameToInstrumentId['minecraft:stone'],
  },
} as const

const customPaletteBlockIds = {
  chestNorthLeft: 100,
  chestNorthRight: 101,
  chestSouthLeft: 102,
  chestSouthRight: 103,
  chestEastLeft: 104,
  chestEastRight: 105,
  chestWestLeft: 106,
  chestWestRight: 107,

  air: 110,
  noteNotUsedBlockId: 111, // note does not exist at all
  singleStreamMissingBlockId: 112, // missing one of the two double chests
} as const

const discReaderLayout: string[][] = (() => {
  const csvContent = readFileSync('./resource/layouts/13x8.csv', 'utf-8')
  const layout = csvContent
    .trim()
    .split('\n')
    .map(line => line.split(','))

  const validPattern = /^[A-E]([0-1]\d|2[0-4])$/
  const seenEntries = new Set<string>()

  for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < layout[y].length; x++) {
      const entry = layout[y][x]

      if (entry === '') {
        continue
      }

      if (!validPattern.test(entry)) {
        throw `invalid CSV entry at position (${x}, ${y}): "${entry}". Must match pattern [A-E][00-24] or be empty.`
      }

      if (seenEntries.has(entry)) {
        throw `duplicate CSV entry found: "${entry}" at position (${x}, ${y})`
      }
      seenEntries.add(entry)
    }
  }

  return layout
})()

// developer notice: do not include any trailing commas in the layout
const discReaderLayoutMaxWidth = discReaderLayout.reduce((max, arr) => {
  if (arr.length > max) {
    return arr.length
  }

  return max
}, 0)

function getChestPaletteId(side: 'left' | 'right', direction: Direction): number {
  if (direction === 'north') {
    return side === 'left' ? customPaletteBlockIds.chestNorthLeft : customPaletteBlockIds.chestNorthRight
  }
  if (direction === 'south') {
    return side === 'left' ? customPaletteBlockIds.chestSouthLeft : customPaletteBlockIds.chestSouthRight
  }
  if (direction === 'east') {
    return side === 'left' ? customPaletteBlockIds.chestEastLeft : customPaletteBlockIds.chestEastRight
  }
  if (direction === 'west') {
    return side === 'left' ? customPaletteBlockIds.chestWestLeft : customPaletteBlockIds.chestWestRight
  }

  throw new Error(`Invalid direction: ${direction}`)
}

// Helper function: Step 1 - Find direction and section for an instrument
function findInstrumentPositions(instrumentId: InstrumentId): { direction: Direction; section: Section }[] {
  const possiblePositions: { direction: Direction; section: Section }[] = []

  for (const [direction, sections] of Object.entries(directionSectionToInstrument) as [
    Direction,
    Record<Section, InstrumentId>,
  ][]) {
    for (const [section, mappedInstrumentId] of Object.entries(sections) as [Section, InstrumentId][]) {
      if (mappedInstrumentId === instrumentId) {
        possiblePositions.push({ direction, section })
      }
    }
  }

  if (possiblePositions.length === 0) {
    console.error(`instrument ${instrumentId} not found in layout`)
    process.exit(1)
  }

  return possiblePositions
}

// Helper function: Step 2 - Get local coordinates from CSV layout
function getLocalCoordinates(
  instrumentId: InstrumentId,
  noteId: NoteId,
): { x: number; y: number; direction: Direction } {
  const positions = findInstrumentPositions(instrumentId)

  const sectionToLetter: Record<Section, string> = {
    top: 'A',
    middle: 'B',
    bottom: 'C',
    'percussion-left': 'E',
    'percussion-right': 'D',
  }

  if (positions.length > 1) {
    console.info(`glc: instrument ${instrumentBlockIds[instrumentId]} has multiple positions:`, positions)
  }

  for (const position of positions) {
    const letter = sectionToLetter[position.section]
    const noteIndex = noteId.toString().padStart(2, '0')
    const targetPattern = `${letter}${noteIndex}`

    console.debug(`glc: searching for ${targetPattern}`)

    for (let y = 0; y < discReaderLayout.length; y++) {
      for (let x = 0; x < discReaderLayout[y].length; x++) {
        if (discReaderLayout[y][x] === targetPattern) {
          console.debug(`glc: found at x:${x}, y:${y} in section ${position.section} (${position.direction})`)
          return { x, y, direction: position.direction }
        }
      }
    }
  }

  console.error(`glc: instrument ${instrumentBlockIds[instrumentId]} note ${noteId} not found in layout`)
  process.exit(1)
}

// Helper function: Step 3 - Convert local coordinates to world coordinates (coordinates within the schematic region)
function getInRegionCoordinates(
  direction: Direction,
  localX: number,
  localY: number,
): { x: number; y: number; z: number } {
  const adjustedX = localX * 4 + (WALL_DISTANCE - 4 * Math.floor(discReaderLayoutMaxWidth / 2)) - 2
  const invertedY = (discReaderLayout.length - 1 - localY) * 11
  const fullWidth = WALL_DISTANCE * 2

  switch (direction) {
    case 'south':
      return { x: WALL_DISTANCE * 2 - adjustedX, y: invertedY, z: fullWidth }
    case 'west':
      return { x: 0, y: invertedY, z: WALL_DISTANCE * 2 - adjustedX }
    case 'north':
      return { x: adjustedX, y: invertedY, z: 0 }
    case 'east':
      return { x: fullWidth, y: invertedY, z: adjustedX }
  }
}

/* todo: fix work with mulitple possible positions
// Helper function: Combined - Get chest position from instrument and note
function getChestPosition(instrumentId: InstrumentId, noteId: NoteId): { x: number; y: number; z: number } | undefined {
  const localCoords = getLocalCoordinates(instrumentId, noteId)
  if (!localCoords) {
    return undefined
  }

  const position = findInstrumentPosition(instrumentId)
  if (!position) {
    return undefined
  }

  return getInRegionCoordinates(position.direction, localCoords.x, localCoords.y)
}
*/

export async function parseInstrumentStreams(
  input: Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>>,
): Promise<Uint8Array> {
  const instrumentIdsOrdered = Object.keys(input)
    .map(Number)
    .sort((a, b) => a - b)

  console.log(instrumentIdsOrdered)
  // ×

  const width = WALL_DISTANCE * 2 + 1
  const depth = width
  const height = discReaderLayout.length * 10 + 1

  const coordinateToIndexXZY = createAccessIndexFunctionXZY(width, depth, height)

  // create the palette
  const palette: BlockPalette = {}
  for (const [instrumentId, blockName] of Object.entries(instrumentBlockIds)) {
    palette[blockName] = new Int32(Number(instrumentId))
  }

  // Add all directional chest variants
  palette['minecraft:chest[facing=north,type=left]'] = new Int32(customPaletteBlockIds.chestNorthLeft)
  palette['minecraft:chest[facing=north,type=right]'] = new Int32(customPaletteBlockIds.chestNorthRight)
  palette['minecraft:chest[facing=south,type=left]'] = new Int32(customPaletteBlockIds.chestSouthLeft)
  palette['minecraft:chest[facing=south,type=right]'] = new Int32(customPaletteBlockIds.chestSouthRight)
  palette['minecraft:chest[facing=east,type=left]'] = new Int32(customPaletteBlockIds.chestEastLeft)
  palette['minecraft:chest[facing=east,type=right]'] = new Int32(customPaletteBlockIds.chestEastRight)
  palette['minecraft:chest[facing=west,type=left]'] = new Int32(customPaletteBlockIds.chestWestLeft)
  palette['minecraft:chest[facing=west,type=right]'] = new Int32(customPaletteBlockIds.chestWestRight)

  // Utility blocks
  palette['minecraft:air'] = new Int32(customPaletteBlockIds.air)
  palette['minecraft:blackstone_stairs[facing=south,half=top,shape=straight]'] = new Int32(
    customPaletteBlockIds.noteNotUsedBlockId,
  )
  palette['minecraft:quartz_stairs[facing=south,half=top,shape=straight]'] = new Int32(
    customPaletteBlockIds.singleStreamMissingBlockId,
  )

  const blockIds: number[] = new Array(width * height * depth).fill(customPaletteBlockIds.air)

  // section: debug test

  const debugNoteValues: [(typeof instrumentBlockIds)[number], NoteId][] = []
  for (const instrumentName of instrumentBlockIds) {
    for (let noteId = 0; noteId < 25; noteId++) {
      debugNoteValues.push([instrumentName, noteId])
    }
  }

  for (const [blockName, noteId] of debugNoteValues) {
    const instrumentId: InstrumentId = instrumentBlockIds.indexOf(blockName)

    const localCoords = getLocalCoordinates(instrumentId, noteId)
    if (!localCoords) {
      throw `whaa, ${instrumentBlockIds[instrumentId]} with note ${noteId} not found in layout`
    }

    const inRegionCoords = getInRegionCoordinates(localCoords.direction, localCoords.x, localCoords.y)
    console.debug(blockName, noteId, 'x:', inRegionCoords.x, 'y:', inRegionCoords.y, 'z:', inRegionCoords.z)
    const coordIndex = coordinateToIndexXZY(inRegionCoords.x, inRegionCoords.z, inRegionCoords.y)

    // set a block for the test
    blockIds[coordIndex] = instrumentId
  }

  const blockEntities: BlockEntity[] = []

  /* FIXME: do chests later
  for (const [instrumentIdAsString, notes] of Object.entries(input)) {
    for (const [noteIdAsString, [stream1, stream2]] of Object.entries(notes)) {
      const instrumentId: InstrumentId = Number(instrumentIdAsString)
      const noteId: NoteId = Number(noteIdAsString)

      function createDoubleChestsInGlobalData(startX: number, y: number, stream: GrayCodeStream) {
        const doubleChestStartIndex = coordinateToIndexXZY(startX, 0, y)
        if (!stream.every(v => v === 0)) {
          blockIds[doubleChestStartIndex] = getChestPaletteId('right', 'south')
          blockIds[doubleChestStartIndex + 1] = getChestPaletteId('left', 'south')

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
  */

  const data: WorldEditSchematic = {
    // worldedit defaults
    Version: new Int32(3),
    DataVersion: new Int32(4189),

    Width: new Int16(width),
    Height: new Int16(height),
    Length: new Int16(depth),

    // simple offset
    Offset: new Int32Array([-Math.floor(width / 2), 0, -Math.floor(depth / 2)]),

    // the actual data
    Blocks: {
      Palette: palette,
      Data: new Int8Array(blockIds),
      BlockEntities: blockEntities,
    },
  }

  const schem: NBTData<Schem> = new NBTData({ Schematic: data }, { compression: 'gzip', endian: 'big' })
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
      currentlyIsPause = false
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
