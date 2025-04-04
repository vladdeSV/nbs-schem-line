# `.nbs` to `.schem` converter

requires [Node.js **v23**](https://nodejs.org/en/blog/release/), which has required experimental TypeScript support.

will create a `.schem` file with a line of bookshelves and the noteblocks that are used—cut and rotate the noteblock 90deg counter-clockwise and paste into the machine.

> [!WARNING]  
> Only 1 layer in NBS is supported, and only one type of instrument

## run

run with

```sh
node --no-warnings index.ts 'Turkish March.nbs'
```

```sh
# optional, provide an output filename
node --no-warnings index.ts 'Turkish March.nbs' output.schem
```
