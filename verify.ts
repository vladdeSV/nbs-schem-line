import '@ungap/compression-stream/poly'
import commandLineArgs from 'command-line-args'
import { read } from 'nbtify'
import type { BlockEntity, Schem } from './source/schematic/types'

const optionDefinitions = [
  { name: 'help', type: Boolean },
  { name: 'src', type: String, multiple: true, defaultOption: true },
]
const options = commandLineArgs(optionDefinitions)

if (options.help) {
  console.info(
    'verify schematic does not include clogged hoppers or droppers\n\nsynopsis\n  $ bun run verify.ts a1.schem a2.schem ... an.schem',
  )

  process.exit(0)
}

function assumeIsWorldEditSchematic(data: unknown): asserts data is Schem {}

for (const source of options.src) {
  const r = Bun.file(source)
  const a = await read(r)
  const d = a.data

  assumeIsWorldEditSchematic(d)

  const schem = d.Schematic

  console.info()
  console.info(`verifying ${source}, size ${schem.Width} × ${schem.Height} × ${schem.Length}`)

  function getWorldCoordinates(
    origin: Int32Array,
    offset: Int32Array,
    inRegionCoords: Int32Array,
  ): [number, number, number] {
    const x = origin[0] + offset[0] + inRegionCoords[0]
    const y = origin[1] + offset[1] + inRegionCoords[1]
    const z = origin[2] + offset[2] + inRegionCoords[2]
    return [x, y, z]
  }

  /*
  const t1 = getWorldCoordinates(new Int32Array([0, 0, 0]), new Int32Array([0, 0, 0]), [0, 0, 0])
  const r1 = [0, 0, 0]
  console.assert(t1[0] === r1[0] && t1[1] === r1[1] && t1[2] === r1[1])
  
  const t2 = getWorldCoordinates(new Int32Array([0, 0, 0]), new Int32Array([-2, 0, 0]), [0, 0, 0])
  const r2 = [-2, 0, 0]
  console.assert(t2[0] === r2[0] && t2[1] === r2[1] && t2[2] === r2[1])
  
  const t3 = getWorldCoordinates(new Int32Array([0, 0, 0]), new Int32Array([-2, 0, 0]), [1, 0, 0])
  const r3 = [-1, 0, 0]
  console.assert(t3[0] === r3[0] && t3[1] === r3[1] && t3[2] === r3[1])
  
  const t4 = getWorldCoordinates(new Int32Array([-3, 0, 0]), new Int32Array([0, 0, 0]), [0, 0, 0])
  const r4 = [-3, 0, 0]
  console.assert(t4[0] === r4[0] && t4[1] === r4[1] && t4[2] === r4[1])
  */

  function isDropperWithInvalidItems(be: BlockEntity): boolean {
    if (be.Id !== 'minecraft:dropper') {
      return false
    }

    // mostly for type checking, but if no data then i guess we good?
    if (be.Data.Items === undefined) {
      return false
    }

    // has no items, which is good (but weird)
    if (be.Data.Items.length === 0) {
      return false
    }

    // okay, we actually allow one type of dropper: it's used as a latch, and contains only one redstone. this is valid
    if (be.Data.Items.length === 1) {
      const item = be.Data.Items[0]
      if (item.id === 'minecraft:redstone' && item.count.valueOf() === 1) {
        return false
      }
    }

    // we found a baddie
    return true
  }

  function isHopperWithInvalidItems(be: BlockEntity): boolean {
    if (be.Id !== 'minecraft:hopper') {
      return false
    }

    // mostly for type checking, but if no data then i guess we good?
    if (be.Data.Items === undefined) {
      return false
    }

    // has no items, which is good
    if (be.Data.Items.length === 0) {
      return false
    }

    // some hoppers might contain either one shovel or one one shulker, this is fine
    if (be.Data.Items.length === 1) {
      const item = be.Data.Items[0]
      if (
        (item.id === 'minecraft:wooden_shovel' || item.id === 'minecraft:shulker_box') &&
        item.count.valueOf() === 1
      ) {
        return false
      }
    }

    return true // whopps, it's a bad one >:c
  }

  const invalidDroppers = schem.Blocks.BlockEntities.filter(isDropperWithInvalidItems)
  const invalidHoppers = schem.Blocks.BlockEntities.filter(isHopperWithInvalidItems)

  for (const invalidDropper of invalidDroppers) {
    const worldCoords = getWorldCoordinates(schem.Metadata!.WorldEdit.Origin, schem.Offset, invalidDropper.Pos)
    console.error(
      `${`found dropper at /tp ${worldCoords[0]} ${worldCoords[1] - 1} ${worldCoords[2]}:`.padEnd(36, ' ')} ${invalidDropper.Data.Items?.map(x => (x.count.valueOf() === 1 ? `${x.id}` : `${x.count} × ${x.id}`)).join(', ')}`,
    )
  }

  for (const invalidHopper of invalidHoppers) {
    const worldCoords = getWorldCoordinates(schem.Metadata!.WorldEdit.Origin, schem.Offset, invalidHopper.Pos)
    console.error(
      `${`found hopper at /tp ${worldCoords[0]} ${worldCoords[1] - 1} ${worldCoords[2]}:`.padEnd(36, ' ')} ${invalidHopper.Data.Items?.map(x => (x.count.valueOf() === 1 ? `${x.id}` : `${x.count} × ${x.id}`)).join(', ')}`,
    )
  }

  if (invalidDroppers.length === 0 && invalidHoppers.length === 0) {
    console.info('schematic ok!')
  }

  console.info()
}
