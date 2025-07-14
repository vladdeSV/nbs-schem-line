import { readFileSync } from 'node:fs'

export const discReaderLayout: string[][] = (() => {
  const csvContent = readFileSync('./resource/layouts/wall_layout.csv', 'utf-8')
  const layout = csvContent
    .trim()
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map(line => line.split(','))

  const validPattern = /^[A-E]([0-1]\d|2[0-4])|M$/
  const seenEntries = new Set<string>()

  for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < layout[y].length; x++) {
      const entry = layout[y][x].trim()

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

  // validate that all required entries are present
  const requiredSections = ['A', 'B', 'C'] // top, middle, bottom (full instruments)
  const percussionSections = ['D', 'E'] // percussion sections (halves)

  // check A00-A24, B00-B24, C00-C24 (3 full instruments × 25 notes = 75 entries each)
  for (const section of requiredSections) {
    for (let note = 0; note <= 24; note++) {
      const noteStr = note.toString().padStart(2, '0')
      const entry = `${section}${noteStr}`
      if (!seenEntries.has(entry)) {
        throw `missing required entry: "${entry}"`
      }
    }
  }

  // count percussion entries (D and E should total 25 entries combined per side)
  let percussionCount = 0
  for (const entry of seenEntries) {
    if (percussionSections.some(section => entry.startsWith(section))) {
      percussionCount++
    }
  }

  if (percussionCount !== 25) {
    throw `percussion sections (D+E) must contain exactly 25 entries total, found ${percussionCount}`
  }

  
  // total should be 100 (3 full instruments × 25 + 1 half instrument × 25 = 75 + 25 = 10)
  let expectedTotal = 100
  if (seenEntries.has('M')) {
    // if mob head exists
    expectedTotal += 1
  }

  if (seenEntries.size !== expectedTotal) {
    throw `expected exactly ${expectedTotal} entries in layout, found ${seenEntries.size}`
  }

  return layout
})()

export const discReaderLayoutMaxWidth = discReaderLayout.reduce((max, arr) => {
  if (arr.length > max) {
    return arr.length
  }

  return max
}, 0)
