/** biome-ignore-all lint/complexity/useSimpleNumberKeys: it makes it much easier to reason with -vladde */
import type { InstrumentId } from '../parse-nbs'
import type { Direction, Section } from './types.ts'

// vladde: the wall distance should be >128, but i put it at a low number for debugging purposes
export const WALL_DISTANCE = 135 // distance from the center to the disc reader wall
export const VERTICAL_SPACING = 8 // blocks between each row of chests
export const GLOBAL_Y_OFFSET = -27 // global y offset for all blocks, for tweaking everything all at once :)

/// source of truth – use this whenever trying to convert between "gray code"
export const xoliksCode = {
  /* number -> xoliks code */
  0b0000: 0b0000,
  0b0001: 0b0100,
  0b0010: 0b0101,
  0b0011: 0b0111,
  0b0100: 0b0110,
  0b0101: 0b0001,
  0b0110: 0b0011,
  0b0111: 0b0010,
  0b1000: 0b1010,
  0b1001: 0b1011,
  0b1010: 0b1001,
  0b1011: 0b1000,
  0b1100: 0b1100,
  0b1101: 0b1101,
  0b1110: 0b1111,
  0b1111: 0b1110,
}

export const signalStrengthToDiscName = {
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

export const woolBlockIds = [
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

export const instrumentBlockIds = [
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

  // mob heads
  'minecraft:dragon_head',
  'minecraft:creeper_head',
  'minecraft:skeleton_skull',
  'minecraft:zombie_head',

] as const

export type InstrumentName = (typeof instrumentBlockIds)[number]

const blockNameToInstrumentId = Object.fromEntries(
  instrumentBlockIds.map((blockName, index) => [blockName, index]),
) as Record<string, InstrumentId>

export const directionSectionToInstrument: Record<Direction, Record<Section, InstrumentId>> = {
  north: {
    top: blockNameToInstrumentId['minecraft:glowstone'],
    middle: blockNameToInstrumentId['minecraft:gold_block'],
    bottom: blockNameToInstrumentId['minecraft:packed_ice'],
    'percussion-left': blockNameToInstrumentId['minecraft:stone'],
    'percussion-right': blockNameToInstrumentId['minecraft:soul_sand'],
    'mob-head': blockNameToInstrumentId['minecraft:creeper_head'],
  },
  south: {
    top: blockNameToInstrumentId['minecraft:clay'],
    middle: blockNameToInstrumentId['minecraft:iron_block'],
    bottom: blockNameToInstrumentId['minecraft:bone_block'],
    'percussion-left': blockNameToInstrumentId['minecraft:glass'],
    'percussion-right': blockNameToInstrumentId['minecraft:sand'],
    'mob-head': blockNameToInstrumentId['minecraft:skeleton_skull'],
  },
  east: {
    top: blockNameToInstrumentId['minecraft:emerald_block'],
    middle: blockNameToInstrumentId['minecraft:pumpkin'],
    bottom: blockNameToInstrumentId['minecraft:hay_block'],
    'percussion-left': blockNameToInstrumentId['minecraft:soul_sand'],
    'percussion-right': blockNameToInstrumentId['minecraft:glass'],
    'mob-head': blockNameToInstrumentId['minecraft:zombie_head'],
  },
  west: {
    top: blockNameToInstrumentId['minecraft:white_wool'],
    middle: blockNameToInstrumentId['minecraft:oak_planks'],
    bottom: blockNameToInstrumentId['minecraft:dirt'],
    'percussion-left': blockNameToInstrumentId['minecraft:sand'],
    'percussion-right': blockNameToInstrumentId['minecraft:stone'],
    'mob-head': blockNameToInstrumentId['minecraft:dragon_head'],
  },
} as const

export const customPaletteBlockIds = {
  chestNorthLeft: 100,
  chestNorthRight: 101,
  chestSouthLeft: 102,
  chestSouthRight: 103,
  chestEastLeft: 104,
  chestEastRight: 105,
  chestWestLeft: 106,
  chestWestRight: 107,

  signNorth: 108,
  signSouth: 109,
  signEast: 110,
  signWest: 111,

  air: 120,
  noteNotUsedBlockId: 121, // note does not exist at all
} as const

export function getChestPaletteId(side: 'left' | 'right', direction: Direction): number {
  if (direction === 'south') {
    return side === 'left' ? customPaletteBlockIds.chestNorthLeft : customPaletteBlockIds.chestNorthRight
  }
  if (direction === 'north') {
    return side === 'left' ? customPaletteBlockIds.chestSouthLeft : customPaletteBlockIds.chestSouthRight
  }
  if (direction === 'west') {
    return side === 'left' ? customPaletteBlockIds.chestEastLeft : customPaletteBlockIds.chestEastRight
  }
  if (direction === 'east') {
    return side === 'left' ? customPaletteBlockIds.chestWestLeft : customPaletteBlockIds.chestWestRight
  }

  throw `invalid direction: ${direction}`
}
