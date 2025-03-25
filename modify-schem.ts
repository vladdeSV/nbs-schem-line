import { readFileSync } from 'fs'
import { Int16, Int32, Int8, read, write, type NBTData } from 'nbtify'

export async function vladde(inputSignal: number[]): Promise<Uint8Array> {
  const rawBuffer: Buffer = readFileSync('base.schem')
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

  // function blockIndexAtPosition(blocks: any[], x: number, y: number, z: number) {
  //   return blocks[y * hack.Height * hack.Length + z * hack.Width + x]
  // }

  // function coordinateToBlockIndex(x: number, y: number, z: number) {
  //   return new Int32(y * hack.Height * hack.Length + z * hack.Width + x)
  // }

  hack.Width = new Int16(inputSignal.length)
  hack.Height = new Int16(1)
  hack.Length = new Int16(1)
  hack.Offset = new Int32Array([1, 0, 0])
  hack.Blocks.Palette = {}
  hack.Blocks.Palette['minecraft:air'] = new Int32(0)
  hack.Blocks.Palette['minecraft:chiseled_bookshelf[facing=east,slot_0_occupied=false,slot_1_occupied=false,slot_2_occupied=false,slot_3_occupied=true,slot_4_occupied=false,slot_5_occupied=false]'] = new Int32(1)
  hack.Blocks.Data = new Int8Array(inputSignal.map(v => (v > 0 ? 1 : 0)))

  hack.Blocks.BlockEntities = []
  for (let i = 0; i < inputSignal.length; i++) {
    if (inputSignal[i] === 0) {
      continue
    }

    hack.Blocks.BlockEntities.push({
      Id: 'minecraft:chiseled_bookshelf',
      Pos: new Int32Array([i, 0, 0]),
      Data: {
        last_interacted_slot: new Int32(inputSignal[i] - 1),
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
  console.dir(data, { depth: 4 })

  return await write(data)
}
