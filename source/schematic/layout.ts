
export const discReaderLayout: string[][] = (() => {
  const csvContent = `
   ,   ,A24,   ,A21,   ,A18,   ,A22,   ,A23,   ,   ,   
E21,  M,A15,A20,A11,A16,A06,A13,A12,A17,A14,A19,D20,D24
E13,E17,A08,A09,A01,A05,A00,A03,A02,A04,A07,A10,D12,D16
E05,E09,B19,B23,B05,B12,B01,B09,B06,B13,B20,B24,D04,D08
E02,E01,B18,B15,B08,B04,B02,B00,B07,B03,B17,B16,D03,D00
E10,E06,C07,B22,C02,B11,C00,B10,C01,B14,C08,B21,D11,D07
E18,E14,C14,C10,C12,C04,C06,C03,C11,C05,C15,C09,D19,D15
   ,E22,C23,C19,C22,C17,C18,C13,C21,C16,C24,C20,D23,   
`
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
