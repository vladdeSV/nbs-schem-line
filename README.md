# `.nbs` to `.schem` converter

converts a single `.nbs` file into a WorldEdit schematic specifically used for a custom built Minecraft music machine which runs at 20gt

> [!NOTE]
> requires [Node.js **v23**](https://nodejs.org/en/blog/release/), which has required experimental TypeScript support
>
> verify you have at least v23 by running `node --version`

## pre-everything

download this repository, then `cd` into it and install all dependencies:

```sh
npm i
```

(or if you're cool, use `bun install`. unfortunately the Bun runtime crashes, so Node.js is required)

## convert a file

run with

```sh
node --no-warnings index.ts -v 'Turkish March.nbs' output.schem
```

- `index.ts` is the main file
- `--no-warnings` just turns of the notice that typescript is experimental
- `-v` is for verbose output, which i use to just see what is going on
- `output.schem` is an optional filename; if omitted, the output file will just be the input file name but with an `.nbs` extension

then move the output file into the WorldEdit schematics folder

### configurable variables (and other things)
there are some custom variables that can be tweaked, but they are variables in code. they are found in [`source/schematic/constants.ts`](source/schematic/constants.ts#L5-L7).

- `WALL_DISTANCE` distance in blocks from center to each directional wall. should be >128 for full-scale builds, but currently a low value for debugging
- `VERTICAL_SPACING` amount of spacing between each vertical row of chests
- `GLOBAL_Y_OFFSET` global y-coordinate offset for all blocks, useful for adjusting entire schematic y-position

#### layouts
the code currently reads the [`resource/layouts/xolix.csv`](resource/layouts/xolix.csv) for defining the layout. which file is used can be changed in [`source/schematic/layout.ts`](source/schematic/layout.ts#L4). **do not include trailing commas on any line**.

the layout uses a format like this: every "wall" has 5 associated instruments: three main instruments, and two "halves" of percussion instruments; every instrument has 25 different available notes, 0-24.

an instrument+note position is noted like this: `A05`, `C12`, `D24`. the letters `A`, `B`, and `C` are used for the main instruments, and `D` and `E` are used for the percussions. the code expects 25 of `A`, `B`, and `C` each, but only that `D`+`E` add up to 25. in total, 100 entries per layout. 

to change what instrument is supposed to be in what direciton, please modify the variable `directionSectionToInstrument` in [`source/schematic/constants.ts`](source/schematic/constants.ts#L71)

#### helper visualizer blocks
every instrument+note get a pair of double chests. to easier see what instrument and value is supposed to go into which instrument later on, each pair get a visualizer block.

it is [this section](source/schematic/generator.ts#L95-L143) in the code which adds this visualizer block.

- to remove the block and sign complpetely, just remove that section
- to shift the block, you need to modify the `instrumentBlockCoord`. right now it's just shifted inwards 1 block, but you can modify the coords as you want.
