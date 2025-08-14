import { Int16, Int32, NBTData, write } from 'nbtify'
import type { InstrumentId, NoteId } from '../parse-nbs'
import type { GrayCodeStream } from '../process-binary-stream'
import {
  GLOBAL_Y_OFFSET,
  VERTICAL_SPACING,
  WALL_DISTANCE,
  customPaletteBlockIds,
  getChestPaletteId,
  instrumentBlockIds,
} from './constants.ts'
import {
  coordinateOffset,
  coordinateOffset90DegBasedOnDirection,
  createAccessIndexFunctionXZY,
  getInRegionCoordinates,
  getLocalCoordinates,
  rotateDirectionQuarterClockwise,
} from './coordinates.ts'
import { streamToDoubleChestContents } from './data-conversion.ts'
import { discReaderLayout } from './layout.ts'
import type { BlockEntity, BlockEntityData, BlockPalette, Direction, Schem, WorldEditSchematic } from './types.ts'

export { instrumentBlockIds } from './constants.ts'
export { findInstrumentPositions, getLocalCoordinates } from './coordinates.ts'

export async function parseInstrumentStreams(input: Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>>): Promise<Uint8Array> {
  const centerBlock = 1
  const extraOuterSpacing = 1

  const width = WALL_DISTANCE * 2 + centerBlock + extraOuterSpacing * 2
  const depth = width
  const height = discReaderLayout.length * VERTICAL_SPACING

  const coordinateToIndexXZY = createAccessIndexFunctionXZY(width, depth, height)

  const palette: BlockPalette = {}
  for (const [instrumentId, blockName] of Object.entries(instrumentBlockIds)) {
    palette[blockName] = new Int32(Number(instrumentId))
  }

  palette['minecraft:chest[facing=north,type=left]'] = new Int32(customPaletteBlockIds.chestNorthLeft)
  palette['minecraft:chest[facing=north,type=right]'] = new Int32(customPaletteBlockIds.chestNorthRight)
  palette['minecraft:chest[facing=south,type=left]'] = new Int32(customPaletteBlockIds.chestSouthLeft)
  palette['minecraft:chest[facing=south,type=right]'] = new Int32(customPaletteBlockIds.chestSouthRight)
  palette['minecraft:chest[facing=east,type=left]'] = new Int32(customPaletteBlockIds.chestEastLeft)
  palette['minecraft:chest[facing=east,type=right]'] = new Int32(customPaletteBlockIds.chestEastRight)
  palette['minecraft:chest[facing=west,type=left]'] = new Int32(customPaletteBlockIds.chestWestLeft)
  palette['minecraft:chest[facing=west,type=right]'] = new Int32(customPaletteBlockIds.chestWestRight)

  palette['minecraft:oak_wall_sign[facing=east]'] = new Int32(customPaletteBlockIds.signEast)
  palette['minecraft:oak_wall_sign[facing=west]'] = new Int32(customPaletteBlockIds.signWest)
  palette['minecraft:oak_wall_sign[facing=north]'] = new Int32(customPaletteBlockIds.signNorth)
  palette['minecraft:oak_wall_sign[facing=south]'] = new Int32(customPaletteBlockIds.signSouth)

  palette['minecraft:air'] = new Int32(customPaletteBlockIds.air)
  palette['minecraft:blackstone_stairs[facing=south,half=top,shape=straight]'] = new Int32(
    customPaletteBlockIds.noteNotUsedBlockId,
  )
  palette['minecraft:quartz_stairs[facing=south,half=top,shape=straight]'] = new Int32(
    customPaletteBlockIds.singleStreamMissingBlockId,
  )
  palette['minecraft:dragon_head'] = new Int32(customPaletteBlockIds.dragon)
  palette['minecraft:creeper_head'] = new Int32(customPaletteBlockIds.creeper)
  palette['minecraft:skeleton_skull'] = new Int32(customPaletteBlockIds.skeleton)
  palette['minecraft:zombie_head'] = new Int32(customPaletteBlockIds.zombie)

  const blockIds: number[] = new Array(width * height * depth).fill(customPaletteBlockIds.air)
  const blockEntities: BlockEntity[] = []

  const allPossibleNoteValues: [(typeof instrumentBlockIds)[number], NoteId][] = []
  for (const instrumentName of instrumentBlockIds) {
    for (let noteId = 0; noteId < 25; noteId++) {
      allPossibleNoteValues.push([instrumentName, noteId])
    }
  }

  function createEmptyOutputChestsBasedOnInputChestCoordsInGlobalData(
    baseCoord: { x: number; y: number; z: number },
    direction: Direction,
  ) {
    const newBaseCoord = { ...baseCoord, y: baseCoord.y }
    const chestLookingDirection = rotateDirectionQuarterClockwise(direction, 3)
    const secondCoord = coordinateOffset90DegBasedOnDirection(newBaseCoord, 1, chestLookingDirection)

    const a = coordinateToIndexXZY(newBaseCoord.x, newBaseCoord.z, newBaseCoord.y)
    const b = coordinateToIndexXZY(secondCoord.x, secondCoord.z, secondCoord.y)

    blockIds[a] = getChestPaletteId('right', chestLookingDirection)
    blockIds[b] = getChestPaletteId('left', chestLookingDirection)
  }

  for (const [blockName, noteId] of allPossibleNoteValues) {
    const instrumentId: InstrumentId = instrumentBlockIds.indexOf(blockName)
    const localCoords = getLocalCoordinates(instrumentId, noteId)
    if (!localCoords) {
      throw `whaa, ${instrumentBlockIds[instrumentId]} with note ${noteId} not found in layout`
    }

    const inRegionCoords = getInRegionCoordinates(localCoords.direction, localCoords.x, localCoords.y)
    console.debug(blockName, noteId, 'x:', inRegionCoords.x, 'y:', inRegionCoords.y, 'z:', inRegionCoords.z)

    const ima = coordinateOffset90DegBasedOnDirection(inRegionCoords, 0, localCoords.direction)
    const imb = coordinateOffset90DegBasedOnDirection(inRegionCoords, 2, localCoords.direction)

    createEmptyOutputChestsBasedOnInputChestCoordsInGlobalData(ima, localCoords.direction)
    createEmptyOutputChestsBasedOnInputChestCoordsInGlobalData(imb, localCoords.direction)

    for (let i = 0; i < 4; ++i) {
      const rotatedDirection = rotateDirectionQuarterClockwise(localCoords.direction, 1)
      const oc = coordinateOffset(inRegionCoords, rotatedDirection, i)
      const coordIndex = coordinateToIndexXZY(oc.x, oc.z, oc.y + (VERTICAL_SPACING - 1))
      blockIds[coordIndex] = customPaletteBlockIds.noteNotUsedBlockId
    }
  }

  for (const [instrumentIdAsString, notes] of Object.entries(input)) {
    for (const [noteIdAsString, [stream1, stream2]] of Object.entries(notes)) {
      const instrumentId: InstrumentId = Number(instrumentIdAsString)
      const noteId: NoteId = Number(noteIdAsString)

      function createDoubleChestsInGlobalData(
        baseCoord: { x: number; y: number; z: number },
        direction: Direction,
        stream: GrayCodeStream,
      ) {
        if (!stream.every(v => v === 0)) {
          // physical positioning: baseCoord is the first chest, offset+1 is the second chest
          const firstChestCoord = { ...baseCoord, y: baseCoord.y + (VERTICAL_SPACING - 1) }
          const secondChestCoord = coordinateOffset90DegBasedOnDirection(firstChestCoord, 1, direction)

          const firstChestIndex = coordinateToIndexXZY(firstChestCoord.x, firstChestCoord.z, firstChestCoord.y)
          const secondChestIndex = coordinateToIndexXZY(secondChestCoord.x, secondChestCoord.z, secondChestCoord.y)

          // minecraft's chest types are backwards from our coordinate system:
          // our "first" chest (offset 0) becomes minecraft's "right" type
          // our "second" chest (offset 1) becomes minecraft's "left" type
          blockIds[firstChestIndex] = getChestPaletteId('right', direction)
          blockIds[secondChestIndex] = getChestPaletteId('left', direction)

          function createBlockEntityFromData(
            x: number,
            y: number,
            z: number,
            contents: BlockEntityData[],
          ): BlockEntity {
            return {
              Id: 'minecraft:chest',
              Pos: new Int32Array([x, y, z]),
              Data: {
                id: 'minecraft:chest',
                Items: contents,
              },
            }
          }

          const [contentsLeft, contentsRight] = streamToDoubleChestContents(stream)

          // WARNING WARNING: SPAGHETTI CODE INCOMING

          // because minecraft's chest naming is backwards from our coordinates,
          // we put the "left" contents in our "first" chest (which has minecraft type "right")
          if (contentsLeft.length) {
            const blockEntity = createBlockEntityFromData(
              firstChestCoord.x,
              firstChestCoord.y,
              firstChestCoord.z,
              contentsLeft,
            )
            blockEntities.push(blockEntity)
          }

          if (contentsRight?.length) {
            const blockEntity = createBlockEntityFromData(
              secondChestCoord.x,
              secondChestCoord.y,
              secondChestCoord.z,
              contentsRight,
            )
            blockEntities.push(blockEntity)
          }
        } else {
          const firstChestCoord = { ...baseCoord, y: baseCoord.y + (VERTICAL_SPACING - 1) }
          const secondChestCoord = coordinateOffset90DegBasedOnDirection(firstChestCoord, 1, direction)

          const firstChestIndex = coordinateToIndexXZY(firstChestCoord.x, firstChestCoord.z, firstChestCoord.y)
          const secondChestIndex = coordinateToIndexXZY(secondChestCoord.x, secondChestCoord.z, secondChestCoord.y)

          blockIds[firstChestIndex] = customPaletteBlockIds.singleStreamMissingBlockId
          blockIds[secondChestIndex] = customPaletteBlockIds.singleStreamMissingBlockId
        }
      }

      const localCoords = getLocalCoordinates(instrumentId, noteId)
      const baseCoords = getInRegionCoordinates(localCoords.direction, localCoords.x, localCoords.y)

      const stream1Coords = coordinateOffset90DegBasedOnDirection(baseCoords, 0, localCoords.direction)
      const stream2Coords = coordinateOffset90DegBasedOnDirection(baseCoords, 2, localCoords.direction)

      createDoubleChestsInGlobalData(stream1Coords, localCoords.direction, stream1)
      createDoubleChestsInGlobalData(stream2Coords, localCoords.direction, stream2)
    }
  }

  /*
  for (let i = 0; i < width * depth; ++i) {
    blockIds[i] = i % 2 === 0 ? customPaletteBlockIds.noteNotUsedBlockId : customPaletteBlockIds.singleStreamMissingBlockId
  }
  */

  const data: WorldEditSchematic = {
    Version: new Int32(3),
    DataVersion: new Int32(4189),

    Width: new Int16(width),
    Height: new Int16(height),
    Length: new Int16(depth),

    Offset: new Int32Array([-Math.floor(width / 2), GLOBAL_Y_OFFSET, -Math.floor(depth / 2)]),

    Blocks: {
      Palette: palette,
      Data: new Int8Array(blockIds),
      BlockEntities: blockEntities,
    },
  }

  const schem: NBTData<Schem> = new NBTData({ Schematic: data }, { compression: 'gzip', endian: 'big' })
  return await write(schem)
}
