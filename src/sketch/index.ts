import type { Pixels } from "./../types.js";
import { readFields } from "./fields.js";
import { createPen, drawContours, drawFoliage, drawHatching } from "./strokes.js";
import { traceChains } from "./trace.js";

type SketchOptions = {
  color?: string;
  detail?: number;
  foliage?: boolean;
  roughness?: number;
  seed?: number;
  shading?: number;
  sky?: boolean;
  stroke?: number;
};

type Sketch = { height: number; markup: string; viewBox: string; width: number };

function unit(value: number | undefined, fallback: number, max: number): number {
  const chosen = value ?? fallback;
  if (Number.isFinite(chosen) && chosen >= 0 && chosen <= max) return chosen;
  throw new Error(`@trebired/overprint: a sketch option must lie between 0 and ${max}, got ${chosen}`);
}

function ink(color = "#000"): string {
  if (/^#(?:[\da-f]{3}|[\da-f]{6})$/iu.test(color)) return color;
  throw new Error(`@trebired/overprint: a sketch colour must be #rgb or #rrggbb, got "${color}"`);
}

function rounded(path: string): string {
  return path.replace(/-?\d+\.\d+/g, (value) => String(Math.round(Number(value) * 10) / 10));
}

function layer(path: string, width: number, opacity = 1): string {
  if (!path) return "";
  const fade = opacity < 1 ? ` stroke-opacity="${opacity}"` : "";
  return `<path stroke-width="${Math.round(width * 100) / 100}"${fade} d="${rounded(path)}"/>`;
}

function sketch(pixels: Pixels, options: SketchOptions = {}): Sketch {
  const detail = unit(options.detail, 0.5, 1);
  const shading = unit(options.shading, 1, 2);
  const roughness = unit(options.roughness, 0.55, 3);
  const stroke = unit(options.stroke, 1.1, 8);
  const fields = readFields(pixels, detail, options.sky !== false);
  const pen = createPen(options.seed ?? 1, roughness);
  const { detail: details, outline } = drawContours(pen, traceChains(fields));
  const hatching = drawHatching(pen, fields, shading);
  const foliage = options.foliage === false ? "" : drawFoliage(pen, fields);
  const { width, height } = fields;
  const viewBox = `0 0 ${width} ${height}`;
  const shade = layer(hatching, stroke * 0.6, 0.8) + layer(foliage, stroke * 0.64, 0.85);
  const strokes = shade + layer(details, stroke * 0.7) + layer(outline, stroke * 1.3);
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">`
  +`<g fill="none" stroke="${ink(options.color)}" stroke-linecap="round" stroke-linejoin="round">${strokes}</g></svg>`;
  return { height, markup, viewBox, width };
}

export { sketch };
export type { Sketch, SketchOptions };
