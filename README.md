# `.nbs` to `.schem` converter

requires [Node.js **v23**](https://nodejs.org/en/blog/release/), which has required experimental TypeScript support.

verify you have at least v23 by running
```sh
node --version
```

## run

run with

```sh
node --no-warnings index.ts -v 'Turkish March.nbs'
```

```sh
# optional, provide an output filename
node --no-warnings index.ts -v 'Turkish March.nbs' output.schem
```
