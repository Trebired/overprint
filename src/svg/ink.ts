import { el, round, type OverprintNode } from "./node.js";
import type { Region } from "./region.js";

const WHITE = "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0";

const MIN_TEXTURE = 0.15;

const DEFAULT_TEXTURE = 0.4;

function seedOf(id: string): number {
  return [...id].reduce((total, letter) => (total * 31 + letter.charCodeAt(0)) >>> 0, 7) % 9973;
}

function textureOf(value: number | undefined): number {
  return Math.min(1, Math.max(MIN_TEXTURE, value ?? DEFAULT_TEXTURE));
}

function inkFilter(id: string, texture: number | undefined, region: Region): OverprintNode {
  const amount = textureOf(texture);
  const seed = seedOf(id);
  const density = `${round(4 * amount)} 0 0 0 ${round(1 - 2.5 * amount)}`;
  return el("filter", { ...region, "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", id }, [
      el("feColorMatrix", { in: "SourceGraphic", result: "solid", type: "matrix", values: WHITE }),
      el("feTurbulence", { baseFrequency: 0.05, numOctaves: 2, result: "warp", seed, type: "turbulence" }),
      el("feDisplacementMap", {
          in: "solid",
          in2: "warp",
          result: "rough",
          scale: round(1 + 2 * amount),
          xChannelSelector: "R",
          yChannelSelector: "G",
      }),
      el("feTurbulence", { baseFrequency: 0.85, numOctaves: 1, result: "grain", seed: seed + 1, type: "fractalNoise" }),
      el("feTurbulence", { baseFrequency: 0.012, numOctaves: 2, result: "mottle", seed: seed + 2, type: "fractalNoise" }),
      el("feComposite", { in: "grain", in2: "mottle", k2: 0.6, k3: 0.4, operator: "arithmetic", result: "noise" }),
      el("feColorMatrix", { in: "noise", result: "density", type: "matrix", values: `${density} ${density} ${density} 0 0 0 0 1` }),
      el("feComposite", { in: "rough", in2: "density", k1: 1, operator: "arithmetic" }),
  ]);
}

function flatFilter(id: string, region: Region): OverprintNode {
  return el("filter", { ...region, "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", id }, [
      el("feColorMatrix", { in: "SourceGraphic", type: "matrix", values: WHITE }),
  ]);
}

export { DEFAULT_TEXTURE, flatFilter, inkFilter, MIN_TEXTURE };
