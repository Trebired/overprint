import { el, round, type OverprintNode } from "./node.js";
import type { Wave } from "./../types.js";

const SPAN = 1000;
const STEPS = 16;
const MARGIN_X = 0.1;
const REGION = { height: "150%", width: "120%", x: "-10%", y: "-25%" };

type WaveParts = { defs: OverprintNode[]; style: string; wrap: (content: OverprintNode) => OverprintNode };

type WaveShape = { from: number; length: number; period: number; to: number };

function shapeOf(wave: Wave): WaveShape {
  const [from, to] = wave.along || [0, 1];
  return { from, length: Math.max(0.05, wave.length ?? 0.4), period: Math.max(0.2, wave.period ?? 3.5), to };
}

function svgUri(width: number, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${SPAN}" viewBox="0 0 ${width} ${SPAN}" preserveAspectRatio="none">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function sineMap(shape: WaveShape, color: (phase: number) => string): string {
  const period = round(shape.length * SPAN);
  const width = round((1 + MARGIN_X * 2 + shape.length) * SPAN);
  const stops = Array.from({ length: STEPS + 1 }, (_, step) => {
      const offset = step / STEPS;
      return `<stop offset="${round(offset)}" stop-color="${color(offset * Math.PI * 2)}"/>`;
  }).join("");
  const gradient = `<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="0" x2="${period}" spreadMethod="repeat">${stops}</linearGradient>`;
  return svgUri(width, `<defs>${gradient}</defs><rect width="${width}" height="${SPAN}" fill="url(#s)"/>`);
}

function rampMap(from: number, to: number, low: string, high: string): string {
  const offset = (value: number) => round((value + MARGIN_X) / (1 + MARGIN_X * 2));
  const stops = `<stop offset="${offset(from)}" stop-color="${low}"/><stop offset="${offset(to)}" stop-color="${high}"/>`;
  const width = round((1 + MARGIN_X * 2) * SPAN);
  const gradient = `<linearGradient id="r" x1="0" x2="1">${stops}</linearGradient>`;
  return svgUri(width, `<defs>${gradient}</defs><rect width="${width}" height="${SPAN}" fill="url(#r)"/>`);
}

function moving(href: string, shape: WaveShape, result: string): OverprintNode {
  const start = `${round(-(MARGIN_X + shape.length) * 100)}%`;
  const width = `${round((1 + MARGIN_X * 2 + shape.length) * 100)}%`;
  return el("feImage", { height: REGION.height, href, preserveAspectRatio: "none", result, width, x: start, y: REGION.y }, [
      el("animate", { attributeName: "x", dur: `${round(shape.period)}s`, from: start, repeatCount: "indefinite", to: REGION.x }),
  ]);
}

function still(href: string, result: string): OverprintNode {
  return el("feImage", { ...REGION, href, preserveAspectRatio: "none", result });
}

function shadeSteps(shape: WaveShape, strength: number): OverprintNode[] {
  const tint = (phase: number) => {
    const level = Math.round(255 * strength * Math.max(0, -Math.cos(phase - 0.6)));
    return `rgb(${level},${level},${level})`;
  };
  return [
    moving(sineMap(shape, tint), shape, "shadeWave"),
    still(rampMap(shape.from, shape.from +(shape.to - shape.from) / 2, "#000", "#fff"), "shadeRamp"),
    el("feComposite", { in: "shadeWave", in2: "shadeRamp", k1: 1, operator: "arithmetic", result: "shadeLevel" }),
    el("feColorMatrix", { in: "shadeLevel", result: "shadeAlpha", type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" }),
    el("feComposite", { in: "SourceGraphic", in2: "shadeAlpha", operator: "in", result: "shaded" }),
  ];
}

function waveFilter(id: string, wave: Wave): OverprintNode {
  const shape = shapeOf(wave);
  const strength = Math.max(0, Math.min(1, wave.shade ?? 0));
  const sine = (phase: number) => `rgb(${Math.round(128 + 127 * Math.sin(phase))},128,128)`;
  return el("filter", { ...REGION, "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", id }, [
      ...(strength > 0 ? shadeSteps(shape, strength) : []),
      moving(sineMap(shape, sine), shape, "wave"),
      still(rampMap(shape.from, shape.to, "#000", "#fff"), "ramp"),
      el("feComposite", { in: "wave", in2: "ramp", k1: 1, k2: 0, k3: -0.5, k4: 0.5, operator: "arithmetic", result: "map" }),
      el("feDisplacementMap", {
          in: strength > 0 ? "shaded" : "SourceGraphic",
          in2: "map",
          scale: round(2 * (wave.amplitude ?? 12)),
          xChannelSelector: "G",
          yChannelSelector: "R",
      }),
  ]);
}

function waveParts(id: string, wave: Wave | undefined): WaveParts | null {
  if (!wave) return null;
  const calm = [`#${id}wg{filter:none}`, wave.shade ? `#${id}wg{visibility:hidden}` : ""].join("");
  return {
    defs: [waveFilter(`${id}w`, wave)],
    style: `@media (prefers-reduced-motion: reduce){${calm}}`,
    wrap: (content) => el("g", { filter: `url(#${id}w)`, id: `${id}wg` }, [content]),
  };
}

export { waveParts };
