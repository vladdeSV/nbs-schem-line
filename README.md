# `.nbs` to `.schem` converter

converts a single `.nbs` file into a WorldEdit schematic specifically used for a custom built Minecraft music machine which runs at 20gt

> [!NOTE]
> requires [Node.js **v23**](https://nodejs.org/en/blog/release/), which has required experimental TypeScript support
>
> verify you have at least v23 by running `node --version`

## pre-everything

install all dependencies

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
