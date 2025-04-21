/// ai generated
function padToMultipleOf4Mutating(arr: boolean[]): void {
  const remainder = arr.length % 4
  const paddingNeeded = remainder === 0 ? 0 : 4 - remainder
  for (let i = 0; i < paddingNeeded; i++) {
    arr.push(false)
  }
}

/// ai generated, wth?
function separateEveryOther<T>(input: T[]): [T[], T[]] {
  const first: T[] = []
  const second: T[] = []

  for (let i = 0; i < input.length; i += 2) {
    first.push(input[i])
    if (i + 1 < input.length) {
      second.push(input[i + 1])
    }
  }

  return [first, second]
}

/// used to get the redstone signal (thus, disc) from the note value
function getReverseGrayCode(value: number): number | undefined {
  const reverseGrayCodeLookup: Record<number, number> = {
    0b0000: 0,
    0b0001: 1,
    0b0011: 2,
    0b0010: 3,
    0b0110: 4,
    0b0111: 5,
    0b0101: 6,
    0b0100: 7,
    0b1100: 8,
    0b1101: 9,
    0b1111: 10,
    0b1110: 11,
    0b1010: 12,
    0b1011: 13,
    0b1001: 14,
    0b1000: 15,
  }

  return reverseGrayCodeLookup[value] !== undefined ? reverseGrayCodeLookup[value] : undefined
}

/// ai generated
function foo(input: boolean[]): [number[], number[]] {
  const [first, second] = separateEveryOther(input)

  if (first.length !== second.length) {
    second.push(false)
  }
  console.assert(first.length === second.length, first.length, second.length)

  padToMultipleOf4Mutating(first)
  padToMultipleOf4Mutating(second)

  console.assert(first.length === second.length, first.length, second.length)

  const firstResult: number[] = []
  const secondResult: number[] = []

  for (let i = 0; i < first.length; i += 4) {
    const byte =
      ((first[i] ? 1 : 0) << 3) | ((first[i + 1] ? 1 : 0) << 2) | ((first[i + 2] ? 1 : 0) << 1) | (first[i + 3] ? 1 : 0)
    firstResult.push(getReverseGrayCode(byte) ?? -1)
  }

  for (let i = 0; i < second.length; i += 4) {
    const byte =
      ((second[i] ? 1 : 0) << 3) |
      ((second[i + 1] ? 1 : 0) << 2) |
      ((second[i + 2] ? 1 : 0) << 1) |
      (second[i + 3] ? 1 : 0)
    secondResult.push(getReverseGrayCode(byte) ?? -1)
  }

  return [firstResult, secondResult]
}

export type Hm = undefined | [number[], number[]]
export function bar(parsed: Record<string, boolean[]>): Hm[] {
  const dualstreamsPerNote: Hm[] = new Array(25)
  for (const [key, value] of Object.entries(parsed)) {
    const keyValue = parseInt(key.split('/i:')[0].replace('v:', '')) - 33
    dualstreamsPerNote[keyValue] = foo(value)
  }

  return dualstreamsPerNote
}
