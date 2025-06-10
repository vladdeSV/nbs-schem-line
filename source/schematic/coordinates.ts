import type { InstrumentId, NoteId } from '../parse-nbs'
import { WALL_DISTANCE } from './constants.ts'
import { directionSectionToInstrument, instrumentBlockIds } from './constants.ts'
import { discReaderLayout, discReaderLayoutMaxWidth } from './layout.ts'
import type { Direction, Section } from './types.ts'

export function createAccessIndexFunctionXZY(
  w: number,
  d: number,
  h: number,
): (x: number, z: number, y: number) => number {
  return (x: number, z: number, y: number): number => {
    const result = x + w * z + y * w * d

    if (result < 0 || result >= w * d * h) {
      throw `accessing "out-of-bounds": ${result} (${x}, ${z}, ${y} in ${w}×${d}×${h})`
    }

    return result
  }
}

export function findInstrumentPositions(instrumentId: InstrumentId): { direction: Direction; section: Section }[] {
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

export function getLocalCoordinates(
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

export function getInRegionCoordinates(
  direction: Direction,
  localX: number,
  localY: number,
): { x: number; y: number; z: number } {
  const adjustedX = localX * 4 + (WALL_DISTANCE - 4 * Math.floor(discReaderLayoutMaxWidth / 2))
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

export function coordinateOffset(
  coord: { x: number; y: number; z: number },
  offset: number,
  direction: Direction,
): { x: number; y: number; z: number } {
  switch (direction) {
    case 'south':
      return { x: coord.x - offset, y: coord.y, z: coord.z }
    case 'north':
      return { x: coord.x + offset, y: coord.y, z: coord.z }
    case 'east':
      return { x: coord.x, y: coord.y, z: coord.z + offset }
    case 'west':
      return { x: coord.x, y: coord.y, z: coord.z - offset }
  }
}
