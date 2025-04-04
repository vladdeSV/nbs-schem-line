import { readFileSync } from 'fs'
import { Int16, Int32, Int8, read, write, type NBTData } from 'nbtify'

export async function parseNoteValues(noteValues: number[]): Promise<Uint8Array> {
  const uniqueNotes = [...new Set(noteValues)].filter(v => v > 0)

  function findRedstoneSignalFromNoteValue(noteValue: number): number {
    const index = uniqueNotes.indexOf(noteValue)
    if (index === -1) {
      throw 'note does not exist'
    }

    const value = index + 1

    console.log('findRedstoneSignalFromNoteValue', noteValue, '->', value)

    return value
  }

  console.log('uniqueNotes', uniqueNotes)

  const rawBuffer: Buffer = readFileSync('./resource/base.schem') // assumes we run index.ts in the project root
  const data: NBTData = await read(rawBuffer)

  const hack: {
    Version: number
    DataVersion: number
    Metadata: { Date: number; WorldEdit: unknown[] }
    Width: Int16
    Height: Int16
    Length: Int16
    Offset: Int32Array
    Blocks: { Palette: Record<string, Int32>; Data: Int8Array; BlockEntities: any[] }
  } = (data.data as any).Schematic

  // function blockIndexAtPosition<T>(blocks: T[], x: number, y: number, z: number): T {
  //   return blocks[y * hack.Height * hack.Length + z * hack.Width + x]
  // }

  // function coordinateToBlockIndex(x: number, y: number, z: number): Int32 {
  //   return new Int32(y * hack.Height * hack.Length + z * hack.Width + x)
  // }

  hack.Width = new Int16(noteValues.length)
  hack.Height = new Int16(2)
  hack.Length = new Int16(1)
  hack.Offset = new Int32Array([1, 0, 0])
  hack.Blocks.Palette = {}
  hack.Blocks.Palette['minecraft:air'] = new Int32(0)
  hack.Blocks.Palette['minecraft:chiseled_bookshelf[facing=east,slot_0_occupied=false,slot_1_occupied=false,slot_2_occupied=false,slot_3_occupied=true,slot_4_occupied=false,slot_5_occupied=false]'] = new Int32(1)

  // loop unique notes
  for (let i = 0; i < uniqueNotes.length; i++) {
    const noteValue = uniqueNotes[i]
    hack.Blocks.Palette[`minecraft:note_block[instrument=harp,note=${noteValue},powered=false]`] = new Int32(i + 2)
  }

  hack.Blocks.Data = new Int8Array([...noteValues.map(v => (v > 0 ? 1 : 0)), ...Object.keys(uniqueNotes).map(i => Number(i) + 2)])
  hack.Blocks.BlockEntities = []
  for (let i = 0; i < noteValues.length; i++) {
    if (noteValues[i] === 0) {
      continue
    }

    const redstoneSignal = findRedstoneSignalFromNoteValue(noteValues[i])

    hack.Blocks.BlockEntities.push({
      Id: 'minecraft:chiseled_bookshelf',
      Pos: new Int32Array([i, 0, 0]),
      Data: {
        last_interacted_slot: new Int32(redstoneSignal - 1),
        id: 'minecraft:chiseled_bookshelf',
        Items: [
          {
            count: new Int32(1),
            Slot: new Int8(3),
            id: 'minecraft:book',
          },
        ],
      },
    })
  }

  ;(data.data as any).Schematic = hack

  return await write(data)
}
