import { pngDataUri } from "./../pixels.js";
import { el, round, type OverprintNode } from "./node.js";
import type { Point, Rgb, Tone } from "./../types.js";

type ToneMode = "channel" | "ink";

type TonePaint = { defs: OverprintNode[]; layer: (attrs: Record<string, string>) => OverprintNode };

const FULL = { height: "100%", width: "100%" };

function hex(ink: Rgb): string {
  return `#${ink.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function stop(offset: number, darkness: number, mode: ToneMode, ink: Rgb): OverprintNode {
  const clamped = Math.max(0, Math.min(1, darkness));
  if (mode === "ink") return el("stop", { offset, "stop-color": hex(ink), "stop-opacity": round(clamped) });
  return el("stop", { offset, "stop-color": `rgb(0,${Math.round(255 * (1 - clamped))},0)` });
}

function flatPaint(level: number, mode: ToneMode, ink: Rgb): string {
  if (mode === "ink") return hex(ink);
  return `rgb(0,${Math.round(255 * (1 - Math.max(0, Math.min(1, level))))},0)`;
}

function imageFilter(id: string, mode: ToneMode, ink: Rgb): OverprintNode {
  const [red, green, blue] = ink.map((channel) => round(channel / 255));
  const matrix = mode === "ink"
  ? `0 0 0 0 ${red} 0 0 0 0 ${green} 0 0 0 0 ${blue} -0.299 -0.587 -0.114 0 1`
  : "0 0 0 0 0 0.299 0.587 0.114 0 0 0 0 0 0 0 0 0 0 0 1";
  return el("filter", { "color-interpolation-filters": "sRGB", id, x: 0, y: 0, width: 1, height: 1 }, [
      el("feFlood", { "flood-color": "#fff", result: "paper" }),
      el("feComposite", { in: "SourceGraphic", in2: "paper", operator: "over", result: "sheet" }),
      el("feColorMatrix", { in: "sheet", type: "matrix", values: matrix }),
  ]);
}

function gradient(id: string, tone: Tone, mode: ToneMode, ink: Rgb): OverprintNode | null {
  const [start, end]: Point = tone.kind === "linear" || tone.kind === "radial" ? tone.range || [1, 0] : [1, 0];
  const stops = [stop(0, start, mode, ink), stop(1, end, mode, ink)];
  if (tone.kind === "linear") {
    return el("linearGradient", { id, x1: tone.from [0], x2: tone.to[0], y1: tone.from [1], y2: tone.to[1] }, stops);
  }
  if (tone.kind === "radial") {
    return el("radialGradient", { cx: tone.at[0], cy: tone.at[1], fx: tone.at[0], fy: tone.at[1], id, r: tone.reach }, stops);
  }
  return null;
}

function tonePaint(id: string, tone: Tone, mode: ToneMode, ink: Rgb): TonePaint {
  if (tone.kind === "flat") {
    const opacity = mode === "ink" ? String(round(Math.max(0, Math.min(1, tone.level)))) : undefined;
    const fill = flatPaint(tone.level, mode, ink);
    return { defs: [], layer: (attrs) => el("rect", { ...FULL, ...attrs, fill, "fill-opacity": opacity }) };
  }
  if (tone.kind === "image" || tone.kind === "pixels") {
    const href = tone.kind === "image" ? tone.href : pngDataUri(tone.pixels);
    const filter = imageFilter(id, mode, ink);
    return {
      defs: [filter],
      layer: (attrs) => el("image", { ...FULL, ...attrs, filter: `url(#${id})`, href, preserveAspectRatio: "none" }),
    };
  }
  const defs = [gradient(id, tone, mode, ink)].filter((node): node is OverprintNode => node !== null);
  return { defs, layer: (attrs) => el("rect", { ...FULL, ...attrs, fill: `url(#${id})` }) };
}

export { hex, tonePaint };
export type { ToneMode, TonePaint };
