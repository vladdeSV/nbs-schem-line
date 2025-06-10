import { readFileSync } from 'node:fs'

export const discReaderLayout: string[][] = (() => {
  const csvContent = readFileSync('./resource/layouts/xolix.csv', 'utf-8')
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

export const discReaderLayoutMaxWidth = discReaderLayout.reduce((max, arr) => {
  if (arr.length > max) {
    return arr.length
  }

  return max
}, 0)
