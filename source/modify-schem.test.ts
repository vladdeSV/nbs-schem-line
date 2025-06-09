import { describe, expect, it } from 'bun:test'
import { findInstrumentPositions, instrumentBlockIds } from './modify-schem'

function getInstrumentId(name: (typeof instrumentBlockIds)[number]): number {
  return instrumentBlockIds.indexOf(name)
}

describe('findInstrumentPosition', () => {
  it('should find the correct position for a given instrument ID', () => {
    // manually verified in-game that these are correct
    expect(findInstrumentPositions(getInstrumentId('minecraft:glowstone'))).toEqual([
      {
        direction: 'north',
        section: 'top',
      },
    ])

    expect(findInstrumentPositions(getInstrumentId('minecraft:hay_block'))).toEqual([
      {
        direction: 'east',
        section: 'bottom',
      },
    ])

    expect(findInstrumentPositions(getInstrumentId('minecraft:stone'))).toEqual([
      {
        direction: 'north',
        section: 'percussion-left',
      },
      {
        direction: 'west',
        section: 'percussion-right',
      },
    ])
  })
})

/* // assumes disc-reader-layout.csv is Xolix's layout, removed for now
describe('getLocalCoordinates', () => {
  
  it('should return the correct local coordinates for a given instrument ID', () => {
    const coords = getLocalCoordinates(getInstrumentId('minecraft:glowstone'), 13)
    expect(coords).toEqual({
      x: 15,
      y: 0,
      direction: 'north',
    })
  })
})
*/
