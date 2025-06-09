# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an `.nbs` to `.schem` converter that creates data storage systems for Minecraft music machines. **Important: The output schematic contains only chests with timing data - it does NOT include the actual music machine, note blocks, or redstone circuits.** You must build the redstone player mechanism separately to read from these chests. The system converts Note Block Studio files into WorldEdit schematics containing the "memory" component for music machines that play at 20 game ticks per second.

## Music Machine Architecture

The converter creates timing streams for Minecraft's music system:
- **16 instruments** and **25 different notes** (400 total combinations)
- Each instrument+note combination gets encoded as timing streams indicating which game ticks to play
- Streams are split into two separate channels (every other beat) to run at hopper-speed (8gt)
- Each note requires **2 double chests** (one per stream) that will be placed in a 3D bounding box schematic

### Physical Layout Structure

**Instrument Walls**: The music machine consists of 4 directional walls (north/south/east/west), each containing:
- **3 core sections** (top/middle/bottom) - each section houses 1 instrument with 25 notes in a 5×5 grid
- **Percussion edges** - left and right columns contain percussion instruments that interweave between adjacent walls
- **Total per wall**: 3 instruments + 2 half-percussion = 4 instruments equivalent
- **Total system**: 4 walls × 4 instruments = 16 instruments

**Disc Reader Layout**: Separate from instrument walls, chests are placed in a configurable 20×5 grid pattern:
- Defined in `resource/disc-reader-layout.csv` 
- Each position represents where 2 double chests will be placed
- Layout is identical across all 4 directions
- Manual wiring connects disc readers to appropriate instrument positions

## Development Commands

### Running the Converter
```bash
# Basic usage with verbose output
node --no-warnings index.ts -v 'input.nbs'

# With custom output filename  
node --no-warnings index.ts -v 'input.nbs' output.schem
```

### Code Quality
The project uses Biome for formatting and linting:
- Semicolons: as needed
- Quotes: single quotes
- Line width: 120 characters
- Indent: spaces
- Block statements required

## Requirements

- Node.js v23 (required for experimental TypeScript support)
- Uses `nbtify` library for NBT file manipulation

## Code Architecture

1. **NBS Parsing** (`source/parse-nbs.ts`): Reads binary NBS format and extracts note data into boolean streams for each instrument+note combination
2. **Binary Stream Processing** (`source/process-binary-stream.ts`): Splits streams into dual channels and converts to gray code for redstone timing compatibility
3. **Schematic Generation** (`source/modify-schem.ts`): Creates WorldEdit schematic with chest-based storage system for the timing data

The conversion pipeline transforms musical timing (NBS ticks) into Minecraft game ticks (20/second), encoding the data into physical chest arrangements that drive the redstone music machine.

## Development Guidelines

- Use short and concise tone when writing log messages, throwing, and comments
- Use lowercase, unless uppercase is needed
- Example of a good log message: "too many notes; cannot have more than 27 × 27 item slots for a single note & instrument"