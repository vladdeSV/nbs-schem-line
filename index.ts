import { writeFileSync } from 'fs'
import { schem2HardCodedInstrument } from './source/modify-schem.ts'
import { parseNBSFile } from './source/parse-nbs.ts'
import { bar } from './source/process-binary-stream.ts'

// check if -v flag is passed, if not, set console.log to noop
if (!process.argv.includes('-v')) {
  console.log = () => {}
}

// filter out flags
process.argv = process.argv.filter(arg => !arg.startsWith('-'))

const filepath = process.argv[2]
if (filepath === undefined) {
  console.error('usage: node index.ts <file.nbs> [output.schem]')
  process.exit(1)
}

let output = process.argv[3]

if (output === undefined) {
  output = filepath.replace(/\.nbs$/, '.schem')
  console.info(`info: no output file specified, using './${output}'`)
}

const noteSignals = parseNBSFile(filepath)
const data: Uint8Array<ArrayBufferLike> = await schem2HardCodedInstrument(bar(noteSignals))
// const data: Uint8Array<ArrayBufferLike> = await parseNoteValues(noteSignals)

writeFileSync(output, data)

console.info(`info: wrote to file '${output}'!`)
