import { fieldKernel, type FieldShape } from "./../native/kernels.js";
import { dither, pngDataUri } from "./../pixels.js";
import { el } from "./node.js";
import type { ScreenContext, ScreenResult } from "./screen.js";
import type { DitherScreen, Pixels, Point, Tone } from "./../types.js";

const DEFAULT_SIZE: Point = [480, 480];

function fieldOf(tone: Tone): FieldShape {
  if (tone.kind === "flat") return { kind: 0, range: [0, 0], shape: [tone.level, 0, 0, 0] };
  if (tone.kind === "linear") return { kind: 1, range: tone.range || [1, 0], shape: [tone.from [0], tone.from [1], tone.to[0], tone.to[1]] };
  if (tone.kind === "radial") return { kind: 2, range: tone.range || [1, 0], shape: [tone.at[0], tone.at[1], tone.reach, 0] };
  throw new Error("@trebired/overprint: error-diffusion dither reads a flat, linear, radial, or pixels tone; an image tone needs decoded pixels");
}

function sheetOf(tone: Tone, size: Point, grain: number): Pixels {
  if (tone.kind === "pixels") return tone.pixels;
  const columns = Math.max(1, Math.round(size[0] / grain));
  const rows = Math.max(1, Math.round(size[1] / grain));
  return fieldKernel(columns, rows, fieldOf(tone));
}

function rasterDither(context: ScreenContext, screen: DitherScreen, tone: Tone): ScreenResult {
  const sheet = sheetOf(tone, context.size || DEFAULT_SIZE, Math.max(0.5, screen.grain ?? 2));
  const grain = dither(sheet, { ink: context.ink, mode: screen.mode || "atkinson", threshold: screen.threshold });
  const content = el("image", {
      height: "100%",
      href: pngDataUri(grain, { mask: true }),
      "image-rendering": "optimizeSpeed",
      preserveAspectRatio: "none",
      style: "image-rendering:pixelated",
      width: "100%",
  });
  return { content, defs: [] };
}

export { DEFAULT_SIZE, rasterDither };
