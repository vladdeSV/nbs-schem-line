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
  const separateEveryOther = (stream: Stream): [Stream, Stream] => {
    const first: Stream = []
    const second: Stream = []
    
    stream.forEach((value, index) => {
      if (index % 2 === 0) {
        first.push(value)
      } else {
        second.push(value)
      }
    })

    const removeTrailingFalse = (s: Stream): Stream => {
      const lastTrueIndex = s.findLastIndex(value => value === true)
      return lastTrueIndex === -1 ? [] : s.slice(0, lastTrueIndex + 1)
    }

    return [removeTrailingFalse(first), removeTrailingFalse(second)]
  }

  const padToMultipleOf4 = (stream: Stream): Stream => {
    const remainder = stream.length % 4
    const paddingNeeded = remainder === 0 ? 0 : 4 - remainder
    return [...stream, ...Array(paddingNeeded).fill(false)]
  }

  return Object.fromEntries(
    Object.entries(streams).map(([instrumentId, notes]) => [
      Number(instrumentId),
      Object.fromEntries(
        Object.entries(notes).map(([noteId, stream]) => {
          const [left, right] = separateEveryOther(stream)
          return [
            Number(noteId),
            [padToMultipleOf4(left), padToMultipleOf4(right)] as [Stream, Stream]
          ]
        })
      )
    ])
  )
}

export function getReverseGrayCode(value: number): TruthyGrayValue | 0 {
  const entry = Object.entries(xoliksCode).find(([, code]) => code === value)
  
  if (!entry) {
    throw new Error(`value does not exist in the reverse lookup: ${value}`)
  }

  const signalStrength = Number(entry[0])
  
  if (!isNumberSupportedGrayCode(signalStrength) && signalStrength !== 0) {
    throw new Error(`signal strength is not a supported number: ${signalStrength}`)
  }

  return signalStrength
}

export type GrayCodeStream = number[]
function processStreams(
  splitStreams: Record<InstrumentId, Record<NoteId, [Stream, Stream]>>,
): Record<InstrumentId, Record<NoteId, [GrayCodeStream, GrayCodeStream]>> {
  const encodeStream = (stream: Stream): GrayCodeStream => {
    if (stream.length % 4 !== 0) {
      throw new Error(`stream length is not a multiple of 4: ${stream.length}`)
    }

    const grayCodedStream: GrayCodeStream = []
    for (let i = 0; i < stream.length; i += 4) {
      const byte = stream.slice(i, i + 4)
        .reduce((acc, value, index) => acc | ((value ? 1 : 0) << (3 - index)), 0)

      grayCodedStream.push(getReverseGrayCode(byte))
    }

    return grayCodedStream
  }

  return Object.fromEntries(
    Object.entries(splitStreams).map(([instrumentId, notes]) => [
      Number(instrumentId),
      Object.fromEntries(
        Object.entries(notes).map(([noteId, [leftStream, rightStream]]) => [
          Number(noteId),
          [encodeStream(leftStream), encodeStream(rightStream)] as [GrayCodeStream, GrayCodeStream]
        ])
      )
    ])
  )
}
