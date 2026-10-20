# @trebired/overprint

Risograph-style prints as layered vector SVG: one plate per ink, halftone and dither screens, knockouts, misregistration and motion, rendered to markup in Bun or as a React component, with the pixel work in Rust compiled to WebAssembly.

The package owns the print: turning a tone into ink, screening it into dots or grain, cutting one plate out of another, overprinting the plates the way a stencil duplicator does, and moving them once the page is live. Callers own the artwork each plate prints through, the inks, the element the print sits in and its size, and when it is rendered. The package does not own a canvas, a scene graph, an image loader, layout measurement, or any styling of the element around the print.

## Install

Runtime support: Bun 1+.

```sh
bun i @trebired/overprint
```

## Quick Start

```tsx
import type { Print } from "@trebired/overprint";
import { Overprint } from "@trebired/overprint/react";

const print: Print = {
  plates: [
    {
      art: { d: "M0.98 0.5A0.48 0.48 0 1 1 0.02 0.5A0.48 0.48 0 1 1 0.98 0.5Z", kind: "path" },
      ink: "fluorescentPink",
      offset: [6, -4],
      screen: { angle: 45, cells: 36, kind: "halftone" },
      tone: { at: [0.5, 0.5], kind: "radial", reach: 0.6 },
    },
    {
      art: { kind: "text", text: "PRINT" },
      ink: "blue",
      motion: { drift: 0.6, pull: 8 },
      screen: { kind: "dither", mode: "atkinson" },
      tone: { from: [0, 0.5], kind: "linear", to: [1, 0.5] },
    },
  ],
};

export function Poster() {
  return <Overprint print={print} style={{ inset: 0, position: "absolute" }} />;
}
```

The same print renders without React through `renderPrint(print, { id: "poster" })`, which returns the markup as a string.

## Concepts

### Print and Plates

A `Print` is a stack of plates. Each plate is one ink printed through one piece of art, and each renders as its own `<svg>` layer absolutely positioned over the print's root element. Layers overprint with `mix-blend-mode: multiply`, so overlapping inks darken the way ink does on paper. `paper: "dark"` switches every layer to `screen` for a dark background.

The print has no fixed size. Positions, boxes and tones are fractions of the root element, so the same markup fits any box the caller gives it. A plate's `offset` is in CSS pixels and is the plate's misregistration.

### Overprint Is Required

A print is refused unless it is an overprint. It needs at least two visible plates, and at least two of them must print the same art, or one of them must be a `fill`, so one ink always lands on another. A single plate, plates that never share art, and hidden plates counted as inks all throw. The rule is checked by every renderer: `renderPrint`, `printTree`, `<Overprint>`, `printFill` and `printLayers`.

### Ink Texture

Riso ink is never flat, and neither is a plate. Every plate prints through its ink texture: a fine grain where the paper shows through, slow mottling in the ink density, and slightly rough edges, seeded from the plate's id so the print stays deterministic. Where two plates overlap, both inks show through each other the way they do on a duplicator. `texture` sets the strength from 0.15 to 1, 0.4 by default; it cannot be switched off.

### Inks

`inks` holds the standard risograph ink colours by name: `blue`, `fluorescentPink`, `yellow`, `teal`, `flatGold`, and the rest. A plate's `ink` is an ink name, a `#rgb` or `#rrggbb` string, or an `[r, g, b]` tuple. `inkOf()` resolves any of those and throws on anything else.

### Art

Art is the shape a plate prints through. Anything drawn by the art becomes ink; its own colour is ignored.

| Art | Draws |
| --- | --- |
| `{ kind: "fill" }` | The whole print |
| `{ kind: "path", d, viewBox, rule }` | Path data in its own view box, `[1, 1]` by default |
| `{ kind: "image", href }` | An image, by its alpha |
| `{ kind: "svg", markup, viewBox }` | Inline SVG children |
| `{ kind: "text", text, x, y, anchor, size }` | One line of text in the root element's font |
| `{ kind: "group", parts, rotate }` | Several arts, rotated together about the print's centre |

Path, image and SVG art take a `box` (fractions of the print), a `fit` (`meet`, `slice` or `fill`), an `align`, and a `rotate` in degrees about the box centre.

### Tone

The tone says how much ink lands where. Darkness 1 is full ink, 0 is none.

| Tone | Shape |
| --- | --- |
| `{ kind: "flat", level }` | One level everywhere |
| `{ kind: "linear", from, to, range }` | From `range[0]` at `from` to `range[1]` at `to`, `[1, 0]` by default |
| `{ kind: "radial", at, reach, range }` | From the centre `at` out to `reach` |
| `{ kind: "image", href }` | An image's luminance, dark as ink |
| `{ kind: "pixels", pixels }` | Decoded pixels, dark as ink |

### Screens

The screen decides how the tone reaches the paper.

| Screen | Result |
| --- | --- |
| `{ kind: "solid" }` | Continuous ink, the tone as opacity |
| `{ kind: "halftone", cell, cells, angle, dot, gain }` | A rotated grid of `circle`, `ellipse`, `square`, `line` or `cross` dots sized by the tone; `cell` is the pitch in CSS pixels, `cells` the count across the print |
| `{ kind: "dither", mode: "bayer", grain }` | Ordered dither with `grain`-pixel cells |
| `{ kind: "dither", mode: "threshold", threshold }` | Ink wherever the tone is darker than the threshold |
| `{ kind: "dither", mode: "atkinson" \| "floyd-steinberg", grain, threshold }` | Error-diffusion grain |

Halftone, ordered and threshold screens are pure vector: a pattern carries each cell's distance field, the tone carries the darkness, and one SVG filter thresholds the two into ink at the display's own resolution. They stay sharp at every zoom level and device pixel ratio, and cost a few hundred bytes of markup per plate.

Error diffusion cannot be expressed as vector shapes. Those screens are computed by the Rust kernels at the print's `size` (`[480, 480]` CSS pixels by default) and embedded as a one-bit PNG that the browser scales with pixelated sampling, so the grain stays square and hard-edged.

### Knockouts

`knockout: ["name"]` removes this plate's ink wherever the named plate's art draws, so the paper shows through instead of the inks mixing. `{ plate, spread }` grows the cut by `spread` CSS pixels. A plate with `hidden: true` never renders and exists only to be knocked out by.

### Waves

`wave` ripples a plate along the horizontal axis like cloth: `amplitude` in CSS pixels, `length` as a fraction of the print width, `period` in seconds, and `along` the span where the ripple grows from nothing to full. `shade` adds moving shadow bands at that opacity. The ripple runs inside the SVG and needs no script; under `prefers-reduced-motion` it stops and the shading hides, and `animatePrint()` pauses it while the print is off screen.

## Runtime

### Rendering

`renderPrint()` and `printTree()` are pure. They need no DOM, no canvas and no browser, so a Bun server or a static build renders the finished print into its HTML and the art is visible on the first paint. The same input always produces the same markup.

Every element id inside a print starts with the `id` option, so two prints on one page never collide. The React component derives it from `useId()`, which keeps server and client markup identical through hydration.

### Fills

`printFill(print)` turns a print into a fill for an element's own text instead of layers over a box. It returns the background declarations as a React style object: one `data:` SVG layer per visible plate, the last plate on top, each plate's `offset` as its background position, `multiply` or `screen` between the layers by the print's `paper`, every layer stretched to the element's box, clipped to the text, and the text fill made transparent. `printFillCss(print)` returns the same declarations as a CSS string for server markup. `printLayers(print)` returns the same plates as data, bottom first: each plate's image and offset, and the blend of the paper, for callers that composite the plates themselves.

The layers are vector, so a fill stays sharp at any size; a fill built from halftone or line screens is a few kilobytes. Error-diffusion screens are rasterised at the print's `size` and stretch with the box, so use them in fills only where that box keeps the print's proportions. The fill does not draw an outline: an outlined text keeps its own stroke, and the caller decides how the stroke and the fill are layered.

### Motion

`animatePrint(root, print)` moves each plate by its `motion`: `drift` sways it slowly, `pull` shifts it toward the pointer by that many CSS pixels. It only writes `transform` on the plate layers, pauses while the print is off screen, does nothing under `prefers-reduced-motion`, and returns a function that stops it. `<Overprint>` calls it after mount; pass `motion={false}` to keep the print still.

### Pixel Kernels

Error diffusion, tone sampling, channel separation and PNG encoding run in a WebAssembly module compiled from the Rust crate in `native/`. The module is about 30 KB and ships inside `dist/native/kernels.js`, so consumers need no loader, extra file, or bundler configuration. It starts synchronously the first time a kernel runs; `await prepareKernels()` compiles it ahead of time instead, and `releaseKernels()` returns its working buffers.

`coverage()`, `dither()` and `separate()` work on plain `{ data, width, height }` pixels, `ImageData` included, and return new pixels. `separate()` splits an image into `red`, `green`, `blue`, `cyan`, `magenta`, `yellow` or `black` coverage, ready to feed a plate as a `pixels` tone. `encodePng()` and `pngDataUri()` turn pixels into a PNG.

## Public API

Rendering: `renderPrint`, `printTree`, `toMarkup`.

Fills: `printFill`, `printFillCss`, `printLayers`.

React (`@trebired/overprint/react`): `Overprint`.

Motion: `animatePrint`.

Inks: `inks`, `inkOf`.

Pixels: `coverage`, `dither`, `separate`, `encodePng`, `pngDataUri`.

Kernels: `prepareKernels`, `releaseKernels`.

Types: `Print`, `Plate`, `Art`, `Tone`, `Screen`, `Knockout`, `Wave`, `PlateMotion`, `PrintOptions`, `AnimateOptions`, `OverprintNode`, `PrintFill`, `PrintLayer`, `PrintLayers`, `FillOptions`, `InkInput`, `InkName`, `Pixels`, and the member types of each union.

## What It Does Not Do

This package does not:

- Measure the page; every position is a fraction of the root element.
- Load, decode or fetch images or fonts; image art and image tones are URLs the browser loads.
- Position, size or style the root element.
- Export print-ready files or talk to a printer or a duplicator.
- Match the colour of any physical ink exactly; ink values are screen approximations.
