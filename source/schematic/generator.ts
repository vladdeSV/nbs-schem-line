import { Int8, Int16, Int32, NBTData, write } from 'nbtify'
import type { InstrumentId, NoteId } from '../parse-nbs'
import type { GrayCodeStream } from '../process-binary-stream'
import { WALL_DISTANCE, customPaletteBlockIds, getChestPaletteId, instrumentBlockIds } from './constants.ts'
import {
  coordinateOffset,
  createAccessIndexFunctionXZY,
  getInRegionCoordinates,
  getLocalCoordinates,
} from './coordinates.ts'
import { streamToDoubleChestContents } from './data-conversion.ts'
import { discReaderLayout } from './layout.ts'
import type { BlockEntity, BlockEntityData, BlockPalette, Schem, WorldEditSchematic } from './types.ts'

export { findInstrumentPositions, getLocalCoordinates } from './coordinates.ts'
export { instrumentBlockIds } from './constants.ts'

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

  palette['minecraft:air'] = new Int32(customPaletteBlockIds.air)
  palette['minecraft:blackstone_stairs[facing=south,half=top,shape=straight]'] = new Int32(
    customPaletteBlockIds.noteNotUsedBlockId,
  )
  palette['minecraft:quartz_stairs[facing=south,half=top,shape=straight]'] = new Int32(
    customPaletteBlockIds.singleStreamMissingBlockId,
  )

  const blockIds: number[] = new Array(width * height * depth).fill(customPaletteBlockIds.air)

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
      const oc = coordinateOffset(inRegionCoords, i, localCoords.direction)
      const coordIndex = coordinateToIndexXZY(oc.x, oc.z, oc.y)
      blockIds[coordIndex] = customPaletteBlockIds.noteNotUsedBlockId
    }
  }

  const blockEntities: BlockEntity[] = []

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
          const rightChestCoord = baseCoord
          const leftChestCoord = coordinateOffset(baseCoord, 1, direction)

          const rightChestIndex = coordinateToIndexXZY(rightChestCoord.x, rightChestCoord.z, rightChestCoord.y)
          const leftChestIndex = coordinateToIndexXZY(leftChestCoord.x, leftChestCoord.z, leftChestCoord.y)

          blockIds[rightChestIndex] = getChestPaletteId('right', direction)
          blockIds[leftChestIndex] = getChestPaletteId('left', direction)

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

          if (contentsLeft.length) {
            const blockEntity = createBlockEntityFromData(
              rightChestCoord.x,
              rightChestCoord.y,
              rightChestCoord.z,
              contentsLeft,
            )
            blockEntities.push(blockEntity)
          }

          if (contentsRight?.length) {
            const blockEntity = createBlockEntityFromData(
              leftChestCoord.x,
              leftChestCoord.y,
              leftChestCoord.z,
              contentsRight,
            )
            blockEntities.push(blockEntity)
          }
        } else {
          const rightChestCoord = baseCoord
          const leftChestCoord = coordinateOffset(baseCoord, 1, direction)

          const rightChestIndex = coordinateToIndexXZY(rightChestCoord.x, rightChestCoord.z, rightChestCoord.y)
          const leftChestIndex = coordinateToIndexXZY(leftChestCoord.x, leftChestCoord.z, leftChestCoord.y)

          blockIds[rightChestIndex] = customPaletteBlockIds.singleStreamMissingBlockId
          blockIds[leftChestIndex] = customPaletteBlockIds.singleStreamMissingBlockId
        }
      }

      const localCoords = getLocalCoordinates(instrumentId, noteId)
      const baseCoords = getInRegionCoordinates(localCoords.direction, localCoords.x, localCoords.y)

      const stream1Coords = coordinateOffset(baseCoords, 0, localCoords.direction)
      const stream2Coords = coordinateOffset(baseCoords, 2, localCoords.direction)

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

    Offset: new Int32Array([-Math.floor(width / 2), 0, -Math.floor(depth / 2)]),

    Blocks: {
      Palette: palette,
      Data: new Int8Array(blockIds),
      BlockEntities: blockEntities,
    },
  }

  const schem: NBTData<Schem> = new NBTData({ Schematic: data }, { compression: 'gzip', endian: 'big' })
  return await write(schem)
}
