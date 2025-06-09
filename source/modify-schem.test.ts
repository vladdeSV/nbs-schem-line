import { describe, expect, it } from 'bun:test'
import { findInstrumentPosition, getLocalCoordinates, instrumentBlockIds } from './modify-schem'

function getInstrumentId(name: (typeof instrumentBlockIds)[number]): number {
  return instrumentBlockIds.indexOf(name)
}

const a = findInstrumentPosition(getInstrumentId('minecraft:glowstone'))

describe('findInstrumentPosition', () => {
  it('should find the correct position for a given instrument ID', () => {
    // manually verified in-game that these are correct
    expect(findInstrumentPosition(getInstrumentId('minecraft:glowstone'))).toEqual({
      direction: 'north',
      section: 'top',
    })

    expect(findInstrumentPosition(getInstrumentId('minecraft:hay_block'))).toEqual({
      direction: 'east',
      section: 'bottom',
    })
  })
})

describe('getLocalCoordinates', () => {
  // assumes disc-reader-layout.csv is Xolix's layout
  it('should return the correct local coordinates for a given instrument ID', () => {
    const coords = getLocalCoordinates(getInstrumentId('minecraft:glowstone'), 13)
    expect(coords).toEqual({
      x: 15,
      y: 0,
      direction: 'north',
    })
  })
})
