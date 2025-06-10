the way data is stored in a WorldEdit schematic file is by an array of palette ids.

## example
assume we have a region of the width 4, depth 3, and height 2. the count of the array is 4×3×2 = 24.
however, the index of the ids in the array represent a 3d position in-game.

take the array of these numbers:
```
0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 4, 4, 3
```

using the dimentions specified above, we can represent the numbers like this:
```
0, 0, 0, 1, // layer 0 (bottom), local y=0
0, 0, 0, 0, +-> X
2, 0, 0, 0, Z

0, 0, 0, 3, // layer 1 (top), local y=1
0, 0, 0, 3,
0, 4, 4, 3
```

the first `0` is at (0, 0, 0), then as the numbers continue, the X value increases. once we reach the first 1, we are at coordinates (3, 0, 0). the next number, `0`, is at (0, 0, 1).
