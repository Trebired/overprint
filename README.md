# @trebired/overprint

Risograph-style printing for the browser canvas: one plate per ink, halftone and dither screens, knockouts, misregistered overprint, and per-drum separations, with the pixel work in Rust compiled to WebAssembly.

The package owns the print: turning a tone into ink coverage, screening it into dots or grain, cutting one plate out of another, and laying the plates over each other the way a stencil duplicator does. Callers own the artwork drawn onto each plate, the canvas the print lands on, the animation loop, and any motion or misregistration they want to change over time. The package does not own a render loop, a scene graph, an image loader, a colour picker, or a drawing API beyond the Canvas 2D context it hands to the caller.

## Install

Runtime support: Bun 1+.

```sh
bun i @trebired/overprint
```

## Quick Start

```ts
import { createPrint } from "@trebired/overprint";

const canvas = document.querySelector("canvas")!;
const print = createPrint({ height: canvas.height, width: canvas.width });

const pink = print.plate("fluorescentPink", { offset: [3, -2] });
pink.screen((context, { width, height }) => {
  const ramp = context.createLinearGradient(0, 0, width, 0);
  ramp.addColorStop(0, "#000");
  ramp.addColorStop(1, "#fff");
  context.fillStyle = ramp;
  context.fillRect(0, 0, width, height);
}, { angle: 45, cell: 10, kind: "halftone", shape: "circle" });

const blue = print.plate("blue");
blue.draw((context) => {
  context.font = "bold 180px sans-serif";
  context.fillText("PRINT", 40, 220);
});
pink.knockout(blue);

print.render(canvas.getContext("2d")!);
```

## Concepts

### Print and Plates

A `Print` is one sheet of paper with a fixed pixel size. Each `plate()` call adds one drum: a canvas the size of the print that holds a single ink. Plates are printed in the order they were added, and `render()` lays them over each other with `multiply`, so overlapping inks darken the way real ink does on paper. A print for a dark background takes `blend: "screen"`, which lightens instead.

A plate stores coverage, not colour. Its canvas holds the ink colour everywhere and the amount of ink in the alpha channel. Anything drawn onto a plate becomes that ink, whatever colour it was drawn in.

### Inks

`inks` holds the standard risograph ink colours by name: `blue`, `fluorescentPink`, `yellow`, `teal`, `flatGold`, and the rest. `plate()` takes an ink name, a `#rgb` or `#rrggbb` string, or an `[r, g, b]` tuple. `inkOf()` resolves any of those to a tuple and throws on anything else.

### Drawing and Screening

`plate.draw(paint, { level })` runs `paint` against a clean Canvas 2D context and turns everything it covers into ink at `level` (0 to 1, default 1). Use it for solid shapes and type.

`plate.screen(source, screen)` turns a tone into ink. The source is an image, a canvas, a bitmap, or a function that paints the tone in plate coordinates. Dark means more ink, white means none, and transparent means none. The screen decides how the tone reaches the paper:

| Screen | Result |
| --- | --- |
| `{ kind: "solid" }` | Continuous coverage, one alpha level per pixel |
| `{ kind: "halftone", cell, angle, shape, gain }` | A rotated grid of `circle`, `ellipse`, `square`, `line`, or `cross` dots, sized by the tone; `gain` scales every dot |
| `{ kind: "dither", mode, threshold, scale }` | `atkinson`, `floyd-steinberg`, `bayer`, or `threshold` grain at `scale` of the plate resolution |

### Knockouts

`plate.knockout(other)` removes this plate's ink wherever `other` carries ink, so the paper shows through instead of the two inks mixing. A plate created with `{ hidden: true }` never renders and exists only to knock out other plates.

### Misregistration

Every plate has an `offset`. `render()` draws each plate at its offset, or at whatever `shift(plate, index)` returns, so a caller can drift the drums apart over time without reprinting anything.

### Separations

`print.separations()` returns one black-on-white canvas per visible plate, with its ink and name. Each is the master a duplicator needs for that drum.

## Runtime

### Pixel Kernels

Coverage, dithering, and channel separation run in a WebAssembly module compiled from the Rust crate in `native/`. The module is about 22 KB and ships inside `dist/native/kernels.js`, so consumers need no loader, no extra file, and no bundler configuration.

The module starts synchronously the first time a kernel runs. Call `await prepareKernels()` early to compile it off the critical path instead, which also covers engines that refuse synchronous compilation. `releaseKernels()` returns the module's working buffers to the allocator once printing is done.

### Pixel Functions

`coverage()`, `dither()`, and `separate()` work on plain `{ data, width, height }` pixel objects, which includes `ImageData`, without a canvas. They return new pixels and leave the input untouched. They run in Bun as well as in a browser.

### Surfaces

Plates allocate `<canvas>` elements when a document exists and `OffscreenCanvas` otherwise. Pass `surface: (width, height) => canvas` to `createPrint()` to supply a different canvas implementation. `print.dispose()` releases every plate canvas.

## Public API

Prints: `createPrint`, `Print`, `Plate`.

Pixels: `coverage`, `dither`, `separate`.

Inks: `inks`, `inkOf`.

Kernels: `prepareKernels`, `releaseKernels`.

Types: `PrintOptions`, `PlateOptions`, `RenderOptions`, `Separation`, `Screen`, `SolidScreen`, `HalftoneScreen`, `DitherScreen`, `DitherMode`, `DotShape`, `Channel`, `Blend`, `InkInput`, `InkName`, `Rgb`, `Point`, `Pixels`, `Context2D`, `Surface`, `SurfaceFactory`, `ToneSize`, `ToneSource`.

## What It Does Not Do

This package does not:

- Run an animation loop or schedule frames.
- Load images, fonts, or SVG; sources arrive already decoded.
- Read or write files, or encode PNG or PDF output.
- Match the colour of any physical ink exactly; ink values are screen approximations.
- Talk to a printer or a duplicator.
