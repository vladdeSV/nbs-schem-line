import type { InstrumentId, NoteId } from '../parse-nbs'
import { VERTICAL_SPACING, WALL_DISTANCE, directionSectionToInstrument, instrumentBlockIds } from './constants.ts'
import { discReaderLayout, discReaderLayoutMaxWidth } from './layout.ts'
import type { Direction, Section } from './types.ts'

/// when accessing a block in 3D space, how do we get its position in a 1D array?
/// this converts (x,z,y) coordinates to what i call a "linearized index" – a single number that points to the same spot in a flattened array
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

/// for our layout, where would our music note be on that layout; what x and y coodrinates?
/// this is what i call "local coordinates" – if you're facing the wall, what are the x and y coords?
/// however, there will be four identical layouts — one for each direction — and we need to know "which wall does this disc reader exist at"
///  (this function gives "inverted" y coords)
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
    'mob-head': 'M',
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
        if (discReaderLayout[y][x].trim() === targetPattern) {
          console.debug(`glc: found at x:${x}, y:${y} in section ${position.section} (${position.direction})`)
          return { x, y, direction: position.direction }
        }
      }
    }
  }

  console.error(`glc: instrument ${instrumentBlockIds[instrumentId]} note ${noteId} not found in layout`)
  process.exit(1)
}

/// converts our local coordinates in a direction into in-region world space coordinates
export function getInRegionCoordinates(
  direction: Direction,
  localX: number,
  localY: number,
): { x: number; y: number; z: number } {
  // here be dragons
  const spaghettiExtraSpacing = 1 // for the extra spacing when eptying chests :sob:

  // in order to "center" each wall, we figure out how many blocks should each section should be padded with
  const adjustedX = localX * 4 + (WALL_DISTANCE - 4 * Math.floor(discReaderLayoutMaxWidth / 2)) + spaghettiExtraSpacing
    + ((direction == 'south' || direction == 'west') ? -4 : 2) // mamma mia, sphagettiria
    - 2 // last second change with our decodes, just putthing this here
  // also: because our region width and depth is odd-numbered, the whole thing will be techincally off-centered by 1 block

  // our local y has y=0 at the top, but world space needs y=0 at the bottom (so we flip it)
  // vladde: also, i'm not too sure, but i might have messed up the height here?
  const invertedY = (discReaderLayout.length - 1 - localY) * VERTICAL_SPACING

  // vladde: i think our full width is `WALL_DISTANCE * 2 + 1`, but the caluclations are off if i include the `+ 1`. weird.
  const fullWidth = WALL_DISTANCE * 2

  switch (direction) {
    case 'south':
      return { x: fullWidth - adjustedX, y: invertedY, z: fullWidth + spaghettiExtraSpacing }
    case 'west':
      return { x: 0 + spaghettiExtraSpacing, y: invertedY, z: fullWidth - adjustedX }
    case 'north':
      return { x: adjustedX, y: invertedY, z: spaghettiExtraSpacing }
    case 'east':
      return { x: fullWidth + spaghettiExtraSpacing, y: invertedY, z: adjustedX }
  }
}

/// allows us to easily get the "next coodirnate" by an offset (used for chests)
/// essentially takes a direction, rotates 90° clockwise, then moves in that direction
export function coordinateOffset90DegBasedOnDirection(
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

export function coordinateOffset(
  coord: { x: number; y: number; z: number },
  direction: Direction,
  offset: number,
): { x: number; y: number; z: number } {
  switch (direction) {
    case 'south':
      return { x: coord.x, y: coord.y, z: coord.z + offset }
    case 'north':
      return { x: coord.x, y: coord.y, z: coord.z - offset }
    case 'east':
      return { x: coord.x + offset, y: coord.y, z: coord.z }
    case 'west':
      return { x: coord.x - offset, y: coord.y, z: coord.z }
  }
}

export function rotateDirectionQuarterClockwise(direction: Direction, steps = 1): Direction {
  const directions: Direction[] = ['north', 'east', 'south', 'west']
  const currentIndex = directions.indexOf(direction)
  const newIndex = (currentIndex + steps) % directions.length
  return directions[newIndex]
}
