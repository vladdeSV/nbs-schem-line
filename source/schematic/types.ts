import type { Int16, Int32, Int8 } from 'nbtify'

export interface Schem {
  Schematic: WorldEditSchematic
}

export interface WorldEditSchematic {
  Version: Int32
  DataVersion: Int32
  Metadata?: { Date: number; WorldEdit: unknown[] }
  Width: Int16
  Height: Int16
  Length: Int16
  Offset: Int32Array
  Blocks: {
    Palette: BlockPalette
    Data: Int8Array
    BlockEntities: BlockEntity[]
  }
}

export interface BlockPalette {
  [key: string]: Int32
}

export interface BlockEntity {
  Id: string
  Pos: Int32Array
  Data: {
    id: string
    Items?: BlockEntityData[]
    [key: string]: unknown
  }
}

export interface BlockEntityData {
  id: string
  count: Int32
  Slot: Int8
  components?: Record<string, ItemComponent[]>
}

export interface ItemComponent {
  slot: Int32
  item: {
    id: string
    count: Int32
  }
}

export type Direction = 'north' | 'south' | 'east' | 'west'
export type Section = 'top' | 'middle' | 'bottom' | 'percussion-left' | 'percussion-right' | 'mob-head'
