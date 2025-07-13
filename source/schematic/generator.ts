import { Int16, Int32, Int8, NBTData, write } from 'nbtify'
import type { InstrumentId, NoteId } from '../parse-nbs'
import type { GrayCodeStream } from '../process-binary-stream'
import {
  GLOBAL_Y_OFFSET,
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
import type { BlockEntity, BlockEntityData, BlockPalette, Schem, WorldEditSchematic } from './types.ts'

export { instrumentBlockIds } from './constants.ts'
export { findInstrumentPositions, getLocalCoordinates } from './coordinates.ts'

export async function parseInstrumentStreams(
  input: Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>>,
): Promise<Uint8Array> {
  const instrumentIdsOrdered = Object.keys(input)
    .map(Number)
    .sort((a, b) => a - b)

  console.log(instrumentIdsOrdered)

  const width = WALL_DISTANCE * 2 + 1
  const depth = width
  const height = discReaderLayout.length * 10 + 1

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

  for (const [blockName, noteId] of allPossibleNoteValues) {
    const instrumentId: InstrumentId = instrumentBlockIds.indexOf(blockName)
    const localCoords = getLocalCoordinates(instrumentId, noteId)
    if (!localCoords) {
      throw `whaa, ${instrumentBlockIds[instrumentId]} with note ${noteId} not found in layout`
    }

    const inRegionCoords = getInRegionCoordinates(localCoords.direction, localCoords.x, localCoords.y)
    console.debug(blockName, noteId, 'x:', inRegionCoords.x, 'y:', inRegionCoords.y, 'z:', inRegionCoords.z)

    for (let i = 0; i < 4; ++i) {
      const rotatedDirection = rotateDirectionQuarterClockwise(localCoords.direction, 1)
      const oc = coordinateOffset(inRegionCoords, rotatedDirection, i)
      const coordIndex = coordinateToIndexXZY(oc.x, oc.z, oc.y)
      blockIds[coordIndex] = customPaletteBlockIds.noteNotUsedBlockId
    }

    // -- SNIP HERE --
    // helper blocks, to make it easier to see what instrument and note is where
    const oppositeDirection = rotateDirectionQuarterClockwise(localCoords.direction, 2)

    const instrumentBlockCoord = coordinateOffset(inRegionCoords, oppositeDirection, 1)
    const instrumentBlockIndex = coordinateToIndexXZY(
      instrumentBlockCoord.x,
      instrumentBlockCoord.z,
      instrumentBlockCoord.y,
    )
    blockIds[instrumentBlockIndex] = instrumentId

    if (blockName === 'minecraft:sand' && instrumentBlockCoord.y > 0) {
      // place block underneath the sand block, so it doesn't fall
      const underSandCoord = { ...instrumentBlockCoord, y: instrumentBlockCoord.y - 1 }
      const underSandIndex = coordinateToIndexXZY(underSandCoord.x, underSandCoord.z, underSandCoord.y)
      blockIds[underSandIndex] = customPaletteBlockIds.noteNotUsedBlockId
    }

    const signBlockCoord = coordinateOffset(instrumentBlockCoord, oppositeDirection, 1)
    const signBlockIndex = coordinateToIndexXZY(signBlockCoord.x, signBlockCoord.z, signBlockCoord.y)

    const signBlockId = (dir => {
      switch (dir) {
        case 'north':
          return customPaletteBlockIds.signNorth
        case 'south':
          return customPaletteBlockIds.signSouth
        case 'east':
          return customPaletteBlockIds.signEast
        case 'west':
          return customPaletteBlockIds.signWest
      }
    })(oppositeDirection)

    blockIds[signBlockIndex] = signBlockId
    const signEntity: BlockEntity = {
      Id: 'minecraft:sign',
      Pos: new Int32Array([signBlockCoord.x, signBlockCoord.y, signBlockCoord.z]),
      Data: {
        id: 'minecraft:sign',
        front_text: {
          messages: ['""', `"${noteId}"`, '""', '""'],
          has_glowing_text: new Int8(1),
        },
      },
    }
    blockEntities.push(signEntity)
    // -- SNIP HERE --
  }

  for (const [instrumentIdAsString, notes] of Object.entries(input)) {
    for (const [noteIdAsString, [stream1, stream2]] of Object.entries(notes)) {
      const instrumentId: InstrumentId = Number(instrumentIdAsString)
      const noteId: NoteId = Number(noteIdAsString)

      function createDoubleChestsInGlobalData(
        baseCoord: { x: number; y: number; z: number },
        direction: import('./types').Direction,
        stream: GrayCodeStream,
      ) {
        if (!stream.every(v => v === 0)) {
          // physical positioning: baseCoord is the first chest, offset+1 is the second chest
          const firstChestCoord = baseCoord
          const secondChestCoord = coordinateOffset90DegBasedOnDirection(baseCoord, 1, direction)

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
          const firstChestCoord = baseCoord
          const secondChestCoord = coordinateOffset90DegBasedOnDirection(baseCoord, 1, direction)

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
