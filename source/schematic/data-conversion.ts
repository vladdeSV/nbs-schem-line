import { Int8, Int32 } from 'nbtify'
import type { GrayCodeStream } from '../process-binary-stream'
import { grayCodeToDiscName, woolBlockIds } from './constants.ts'
import type { BlockEntityData, ItemComponent } from './types.ts'

type TruthyGrayValue = keyof typeof grayCodeToDiscName

function isNumberSupportedGrayCode(value: unknown): value is TruthyGrayValue {
  if (typeof value !== 'number') {
    return false
  }

  if (value !== Math.floor(value)) {
    throw `gray code is not an integer: ${value}`
  }

  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
      return true
    default:
      return false
  }
}

type ItemSlotRepresentation =
  | {
      type: 'disc'
      gray: TruthyGrayValue
    }
  | {
      type: 'pause'
      count: number
    }

function streamToItemRepresentation(stream: GrayCodeStream): ItemSlotRepresentation[] {
  const itemSlots: ItemSlotRepresentation[] = []

  let currentPauseAmount = 0
  for (const value of stream) {
    if (currentPauseAmount > 64) {
      itemSlots.push({ type: 'pause', count: 64 })
      currentPauseAmount -= 64
    }

    if (value === 0) {
      currentPauseAmount++
      continue
    }

    if (!isNumberSupportedGrayCode(value)) {
      throw `unsupported value in conversion from gray -> disc: ${value}`
    }

    if (currentPauseAmount > 0) {
      itemSlots.push({ type: 'pause', count: currentPauseAmount })
      currentPauseAmount = 0
    }

    itemSlots.push({ type: 'disc', gray: value })
  }

  return itemSlots
}

function createShulkerBoxContainerListFromItemRepresentations(items: ItemSlotRepresentation[]): ItemComponent[] {
  if (items.length > 27) {
    console.error('cannot process more than 27 items when converting to shulkers')
    process.exit(1)
  }

  const components: ItemComponent[] = []
  let incrementGoingFromPauseToDisc = 0
  let currentlyIsPause = false

  for (const [index, item] of items.entries()) {
    if (item.type === 'pause') {
      currentlyIsPause = true

      const woolItemName = woolBlockIds[incrementGoingFromPauseToDisc]

      components.push({
        item: {
          id: woolItemName,
          count: new Int32(item.count),
        },
        slot: new Int32(index),
      })

      continue
    }

    if (currentlyIsPause) {
      incrementGoingFromPauseToDisc++
      currentlyIsPause = false
    }

    components.push({
      item: {
        id: grayCodeToDiscName[item.gray],
        count: new Int32(1),
      },
      slot: new Int32(index),
    })
  }

  return components
}

function chunkArray<T>(source: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new RangeError('Chunk size must be a positive integer.')
  }
  const result: T[][] = []
  for (let i = 0; i < source.length; i += size) {
    result.push(source.slice(i, i + size))
  }
  return result
}

export function streamToDoubleChestContents(stream: GrayCodeStream): BlockEntityData[][] {
  const itemRepresentations = streamToItemRepresentation(stream)
  if (itemRepresentations.length === 0) {
    return []
  }

  const itemsPerChest = chunkArray(itemRepresentations, 27 * 27)
  if (itemsPerChest.length > 2) {
    throw 'too many notes; cannot have more than 27 × 27 item slots for a single note & instrument'
  }

  const shulkers: BlockEntityData[][] = []
  for (const itemsInChest of itemsPerChest) {
    if (itemsInChest.length === 0) {
      continue
    }

    const bss = chunkArray(itemsInChest, 27)

    const shulkerItemComponents: ItemComponent[][] = []
    for (const shulkerContainerItems of bss) {
      const c = createShulkerBoxContainerListFromItemRepresentations(shulkerContainerItems)
      shulkerItemComponents.push(c)
    }

    const something: BlockEntityData[] = []
    for (const [index, d] of shulkerItemComponents.entries()) {
      something.push({
        count: new Int32(1),
        Slot: new Int8(index),
        components: {
          'minecraft:container': d,
        },
        id: 'minecraft:shulker_box',
      })
    }

    shulkers.push(something)
  }

  if (shulkers.length > 2) {
    console.error('somehow we created more than 2 double chests worth of contents')
    process.exit(1)
  }

  return shulkers
}
