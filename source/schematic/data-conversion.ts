import { Int8, Int32 } from 'nbtify'
import type { GrayCodeStream } from '../process-binary-stream.ts'
import { signalStrengthToDiscName, woolBlockIds } from './constants.ts'
import type { BlockEntityData, ItemComponent } from './types.ts'

export type TruthyGrayValue = keyof typeof signalStrengthToDiscName

export function isNumberSupportedGrayCode(value: unknown): value is TruthyGrayValue {
  if (typeof value !== 'number') {
    return false
  }

  if (value !== Math.floor(value)) {
    throw `gray code is not an integer: ${value}`
  }

  return Number.isInteger(value) && value >= 1 && value <= 15
}

type ItemSlotRepresentation =
  | {
      type: 'disc'
      signal: TruthyGrayValue
    }
  | {
      type: 'pause'
      count: number
    }

/// takes a stream of gray coded numbers, and converts it into a psedudo-item slot representation
/// if there are pauses, it ensures every pause is maximum of 64 items
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

    itemSlots.push({ type: 'disc', signal: value })
  }

  // just ensure there are at least 3 items in total, required by redstone music machine
  const minimumAmountOfItems = 3
  const numStacksInLastShulker = itemSlots.length % 27
  if (numStacksInLastShulker < minimumAmountOfItems) {
    const lastShulkerItems = itemSlots.slice(-numStacksInLastShulker)
    const itemCount = lastShulkerItems.reduce(
      (prev, current) => (current.type === 'pause' ? prev + current.count : prev + 1),
      0,
    )
    if (itemCount < minimumAmountOfItems) {
      itemSlots.push({ type: 'pause', count: minimumAmountOfItems - itemCount })
    }
  }

  return itemSlots
}

/// fills a shulker box with items. the items can't be more than 27
/// the crux of this method is ensuring that when we reach a pause, to use a different wool block for the pauses
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
        id: signalStrengthToDiscName[item.signal],
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

/// takes a stream of gray coded numbers, and converts into one (1) or two (2) lists of items – one list per chest
export function streamToDoubleChestContents(stream: GrayCodeStream): BlockEntityData[][] {
  const itemRepresentations = streamToItemRepresentation(stream)
  if (itemRepresentations.length === 0) {
    return []
  }

  const itemsPerChest = chunkArray(itemRepresentations, 27 * 27)
  if (itemsPerChest.length > 2) {
    throw 'too many notes; cannot have more than 27 × 27 × 2 item slots for a single note & instrument'
  }

  const shulkers: BlockEntityData[][] = []
  for (const itemsInChest of itemsPerChest) {
    if (itemsInChest.length === 0) {
      continue
    }

    const chunkedItems = chunkArray(itemsInChest, 27)
    const shulkerItemComponents: ItemComponent[][] = []
    for (const shulkerContainerItems of chunkedItems) {
      const c = createShulkerBoxContainerListFromItemRepresentations(shulkerContainerItems)
      shulkerItemComponents.push(c)
    }

    const blockEntityDatas: BlockEntityData[] = []
    for (const [index, components] of shulkerItemComponents.entries()) {
      blockEntityDatas.push({
        count: new Int32(1),
        Slot: new Int8(index),
        components: {
          'minecraft:container': components,
        },
        id: 'minecraft:shulker_box',
      })
    }

    shulkers.push(blockEntityDatas)
  }

  if (shulkers.length > 2) {
    console.error('somehow we created more than 2 double chests worth of contents')
    process.exit(1)
  }

  return shulkers
}
