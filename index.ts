import { readFileSync, writeFileSync } from 'node:fs'
import { parseInstrumentStreams } from './source/create-schem.ts'
import { parseNBSFile } from './source/parse-nbs.ts'
import { processBinaryStreams } from './source/process-binary-stream.ts'

// check if -v flag is passed, if not, set console.log to noop
if (!process.argv.includes('-v')) {
  console.debug = () => { }
}

// filter out flags
const filteredArgs = process.argv.filter(arg => !arg.startsWith('-'))

const filepath = filteredArgs[2]
if (filepath === undefined) {
  console.error('usage: node index.ts <file.nbs> [output.schem]')
  process.exit(1)
}

let output = filteredArgs[3]

if (output === undefined) {
  output = filepath.replace(/\.nbs$/, '.schem')
  console.info(`info: no output file specified, using './${output}'`)
}

const useHelpers = process.argv.includes('--use-helpers')

const nbs = readFileSync(filepath)
const notes = parseNBSFile(nbs)
const processed = processBinaryStreams(notes)
const data: Uint8Array<ArrayBufferLike> = await parseInstrumentStreams(processed, useHelpers)

writeFileSync(output, data)
console.info(`info: wrote to file '${output}'! (useHelpers=${useHelpers})`)
