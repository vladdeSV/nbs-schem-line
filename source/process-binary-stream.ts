import type { InstrumentId, NoteId, Stream } from './parse-nbs.js'

export function processBinaryStreams(
  streams: Record<InstrumentId, Record<NoteId, Stream>>,
): Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>> {
  const splitStreams = splitBinaryStreams(streams)
  const processedStreams = processStreams(splitStreams)

  return processedStreams
}

function splitBinaryStreams(
  streams: Record<InstrumentId, Record<NoteId, Stream>>,
): Record<InstrumentId, Record<NoteId, [Stream, Stream]>> {
  /// ai generated
  function separateEveryOther(stream: Stream): [Stream, Stream] {
    const first: Stream = []
    const second: Stream = []
    for (let i = 0; i < stream.length; ++i) {
      if (i % 2 === 0) {
        first.push(stream[i])
      } else {
        second.push(stream[i])
      }
    }
    return [first, second]
  }

  /// ai generated
  function padToMultipleOf4Mutating(stream: Stream): void {
    const remainder = stream.length % 4
    const paddingNeeded = remainder === 0 ? 0 : 4 - remainder
    for (let i = 0; i < paddingNeeded; i++) {
      stream.push(false)
    }
  }

  const result: Record<InstrumentId, Record<NoteId, [Stream, Stream]>> = {}
  for (const [instrumentIdAsString, notes] of Object.entries(streams)) {
    const instrument: InstrumentId = Number(instrumentIdAsString)

    result[instrument] = {}
    for (const [noteValueAsString, stream] of Object.entries(notes)) {
      const note: NoteId = Number(noteValueAsString)

      const [left, right] = separateEveryOther(stream)
      padToMultipleOf4Mutating(left)
      padToMultipleOf4Mutating(right)
      result[instrument][note] = [left, right]
    }
  }

  return result
}

export type GrayCodeStream = number[]
function processStreams(
  a: Record<InstrumentId, Record<NoteId, [Stream, Stream]>>,
): Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>> {
  function encodeStream(stream: Stream): GrayCodeStream {
    console.assert(stream.length % 4 === 0, 'stream length is not a multiple of 4', stream.length)

    /// used to get the redstone signal (thus, disc) from the note value
    function getReverseGrayCode(value: number): number {
      const reverseGrayCodeLookup: Record<number, number> = {
        /* 0000 */ 0: 0,
        /* 0001 */ 1: 1,
        /* 0011 */ 3: 2,
        /* 0010 */ 2: 3,
        /* 0110 */ 6: 4,
        /* 0111 */ 7: 5,
        /* 0101 */ 5: 6,
        /* 0100 */ 4: 7,
        /* 1100 */ 12: 8,
        /* 1101 */ 13: 9,
        /* 1111 */ 15: 10,
        /* 1110 */ 14: 11,
        /* 1010 */ 10: 12,
        /* 1011 */ 11: 13,
        /* 1001 */ 9: 14,
        /* 1000 */ 8: 15,
      }

      if (!(value in reverseGrayCodeLookup)) {
        console.error('value not in reverseGrayCodeLookup', value)
        process.exit(1)
      }

      return reverseGrayCodeLookup[value]
    }

    const grayCodedStream: GrayCodeStream = []
    for (let i = 0; i < stream.length; i += 4) {
      const byte =
        ((stream[i] ? 1 : 0) << 3) |
        ((stream[i + 1] ? 1 : 0) << 2) |
        ((stream[i + 2] ? 1 : 0) << 1) |
        (stream[i + 3] ? 1 : 0)

      const grayCodedByte = getReverseGrayCode(byte)
      grayCodedStream.push(grayCodedByte)
    }

    return grayCodedStream
  }

  const result: Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>> = {}
  for (const [instrumentIdAsString, notes] of Object.entries(a)) {
    const instrument: InstrumentId = Number(instrumentIdAsString)

    result[instrument] = {}
    for (const [noteValueAsString, streams] of Object.entries(notes)) {
      const note: NoteId = Number(noteValueAsString)
      const [leftStream, rightStream] = streams

      const leftGrayCodedStream = encodeStream(leftStream)
      const rightGrayCodedStream = encodeStream(rightStream)

      result[instrument][note] = [leftGrayCodedStream, rightGrayCodedStream]
    }
  }

  return result
}
