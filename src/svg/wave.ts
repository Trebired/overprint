import { el, round, type OverprintNode } from "./node.js";
import type { Wave } from "./../types.js";

const SPAN = 1000;
const STEPS = 16;

type WaveParts = { defs: OverprintNode[]; style: string; wrap: (content: OverprintNode) => OverprintNode };

function sine(length: number, color: (phase: number) => string): string {
  const stops = Array.from({ length: STEPS + 1 }, (_, step) => {
      const offset = step / STEPS;
      return `<stop offset="${round(offset)}" stop-color="${color(offset * Math.PI * 2)}"/>`;
  });
  return `<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="0" x2="${length}" spreadMethod="repeat">${stops.join("")}</linearGradient>`;
}

function map(wave: Wave, color: (phase: number) => string, ramp: string): string {
  const length = round(SPAN * (wave.length ?? 0.4));
  const period = round(wave.period ?? 3.5);
  const motion = `from="0 0" to="${length} 0" dur="${period}s" repeatCount="indefinite"`;
  const travel = `<animateTransform attributeName="transform" type="translate" ${motion}/>`;
  const body = [
    `<defs>${sine(length, color)}${ramp}</defs>`,
    `<rect x="${-length}" width="${SPAN + length * 2}" height="${SPAN}" fill="url(#s)">${travel}</rect>`,
    `<rect width="${SPAN}" height="${SPAN}" fill="url(#r)"/>`,
  ].join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SPAN}" height="${SPAN}" viewBox="0 0 ${SPAN} ${SPAN}" preserveAspectRatio="none">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function ramp(from: number, to: number, color: string): string {
  const ends = `<stop offset="${round(from)}" stop-color="${color}"/><stop offset="${round(to)}" stop-color="${color}" stop-opacity="0"/>`;
  return `<linearGradient id="r" x1="0" x2="1">${ends}</linearGradient>`;
}

function displacement(id: string, wave: Wave): OverprintNode {
  const [from, to] = wave.along || [0, 1];
  const href = map(wave, (phase) => `rgb(${Math.round(128 + 127 * Math.sin(phase))},128,128)`, ramp(from, to, "#808080"));
  const attrs = { "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", height: "150%", id, width: "120%", x: "-10%", y: "-25%" };
  return el("filter", attrs, [
      el("feImage", { height: "100%", href, preserveAspectRatio: "none", result: "map", width: "100%", x: 0, y: 0 }),
      el("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "map",
          scale: round(2 * (wave.amplitude ?? 12)),
          xChannelSelector: "G",
          yChannelSelector: "R",
      }),
  ]);
}

function shading(id: string, wave: Wave, strength: number): OverprintNode {
  const [from, to] = wave.along || [0, 1];
  const tint = (phase: number) => {
    const level = Math.round(255 * strength * Math.max(0, -Math.cos(phase - 0.6)));
    return `rgb(${level},${level},${level})`;
  };
  const href = map(wave, tint, ramp(from, from +(to - from) / 2, "#000"));
  return el("mask", { height: "150%", id, maskUnits: "userSpaceOnUse", width: "120%", x: "-10%", y: "-25%" }, [
      el("image", { height: "100%", href, preserveAspectRatio: "none", width: "100%" }),
  ]);
}

function waveParts(id: string, wave: Wave | undefined): WaveParts | null {
  if (!wave) return null;
  const defs = [displacement(`${id}w`, wave)];
  if (wave.shade) defs.push(shading(`${id}s`, wave, Math.max(0, Math.min(1, wave.shade))));
  const still = [`#${id}wg{filter:none}`, wave.shade ? `#${id}sg{visibility:hidden}` : ""].join("");
  return {
    defs,
    style: `@media (prefers-reduced-motion: reduce){${still}}`,
    wrap: (content) => {
      const shaded = wave.shade ? el("g", { id: `${id}sg`, mask: `url(#${id}s)` }, [content]) : content;
      return el("g", { filter: `url(#${id}w)`, id: `${id}wg` }, [shaded]);
    },
  };
}

export { waveParts };
