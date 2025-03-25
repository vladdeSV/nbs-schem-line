import { writeFileSync } from 'fs'
import { vladde } from './modify-schem.ts'
import { parseNBSFile } from './parse-nbs.ts'

const filepath = 'Turkish March.nbs'
const theInput = parseNBSFile(filepath)
const data: Uint8Array<ArrayBufferLike> = await vladde(theInput)

writeFileSync('output.schem', data)
