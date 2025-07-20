import type { InstrumentId, NoteId, Stream } from './parse-nbs.js'
import { xoliksCode } from './schematic/constants.ts'
import { isNumberSupportedGrayCode, type TruthyGrayValue } from './schematic/data-conversion.ts'

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

/// converts gray code to redstone signal
export function getReverseGrayCode(value: number): TruthyGrayValue | 0 {
  for (const [signalStrength, code] of Object.entries(xoliksCode)) {
    if (value === code) {
      const ss = Number(signalStrength)
      if (!isNumberSupportedGrayCode(ss) && ss !== 0) {
        console.error('signal strength is not a supported number', signalStrength)
        process.exit(1)
      }

      return ss
    }
  }

  console.error('value does not exist in the reverse lookup', value)
  process.exit(1)
}

export type GrayCodeStream = number[]
function processStreams(
  a: Record<InstrumentId, Record<NoteId, [Stream, Stream]>>,
): Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>> {
  function encodeStream(stream: Stream): GrayCodeStream {
    console.assert(stream.length % 4 === 0, 'stream length is not a multiple of 4', stream.length)


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
