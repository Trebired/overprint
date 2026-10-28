import { RoughGenerator } from "roughjs/bin/generator.js";

import type { SketchFields } from "./fields.js";
import { simplify, type Vertex } from "./trace.js";

type Pen = {
  draw: (drawable: ReturnType<RoughGenerator["line"]>) => string;
  generator: RoughGenerator;
  next: () => number;
  random: () => number;
  roughness: number;
};

type HatchLevel = { angle: number; offset: number; spacing: number; threshold: number };

const LEVELS: HatchLevel[] = [
  { angle: 50, offset: 0, spacing: 7, threshold: 0.56 },
  { angle: -40, offset: 0, spacing: 7, threshold: 0.73 },
  { angle: 50, offset: 0.5, spacing: 7, threshold: 0.85 },
  { angle: 8, offset: 0, spacing: 4.5, threshold: 0.93 },
];

const MAJOR_CHAIN = 90;
const MIN_STROKE = 11;
const STEP = 1.5;

function createPen(seed: number, roughness: number): Pen {
  const generator = new RoughGenerator();
  let state = Math.max(1, Math.floor(seed * 7919) % 2147483647);
  let strokeSeed = Math.max(1, Math.floor(seed));
  return {
    draw: (drawable) => generator.toPaths(drawable).map((path) => path.d).join(""),
    next: () => strokeSeed++,
    random: () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    },
    generator,
    roughness,
  };
}

function drawContours(pen: Pen, chains: Vertex[][]): { detail: string; outline: string } {
  let outline = "";
  let detail = "";
  for (const chain of chains) {
    const points = simplify(chain, 1.1);
    if (points.length < 2) continue;
    const major = chain.length > MAJOR_CHAIN;
    const options = { bowing: 0.8, disableMultiStroke: !major, roughness: major ? pen.roughness : pen.roughness * 0.6, seed: pen.next() };
    const path = pen.draw(pen.generator.linearPath(points, options));
    if (major) outline += path;
    else detail += path;
  }
  return { detail, outline };
}

function hatchStroke(pen: Pen, head: Vertex, tail: Vertex): string {
  const shake = (value: number) => value + (pen.random() - 0.5) * 1.6;
  const options = { bowing: 0.6, disableMultiStroke: true, roughness: pen.roughness * 0.8, seed: pen.next() };
  return pen.draw(pen.generator.line(shake(head[0]), shake(head[1]), shake(tail[0]), shake(tail[1]), options));
}

function hatchLine(pen: Pen, fields: SketchFields, level: HatchLevel, origin: Vertex, along: Vertex): string {
  const reach = Math.hypot(fields.width, fields.height);
  const target = 26 + pen.random() * 40;
  let out = "";
  let start: Vertex | null = null;
  let last: Vertex = origin;
  for (let t = -reach; t <= reach; t += STEP) {
    const point: Vertex = [origin[0] + along[0] * t, origin[1] + along[1] * t];
    const inside = point[0] >= 0 && point[1] >= 0 && point[0] < fields.width && point[1] < fields.height
    &&fields.tone(point[0], point[1]) > level.threshold && !fields.leafy(point[0], point[1]);
    if (inside && !start) start = point;
    const full = start !== null && Math.hypot(point[0] - start[0], point[1] - start[1]) > target;
    if (start && (!inside || full)) {
      if (Math.hypot(last[0] - start[0], last[1] - start[1]) > MIN_STROKE) out += hatchStroke(pen, start, last);
      start = inside ? [point[0] + along[0] * 3, point[1] + along[1] * 3] : null;
    }
    last = point;
  }
  return out;
}

function drawHatching(pen: Pen, fields: SketchFields, shading: number): string {
  if (shading <= 0) return "";
  const reach = Math.hypot(fields.width, fields.height);
  let out = "";
  for (const base of LEVELS) {
    const level = { ...base, threshold: 1 - (1 - base.threshold) * shading };
    const angle = (level.angle * Math.PI) / 180;
    const along: Vertex = [Math.cos(angle), Math.sin(angle)];
    const across: Vertex = [-along[1], along[0]];
    for (let s = -reach + level.offset * level.spacing; s < reach; s += level.spacing * (0.85 + pen.random() * 0.3)) {
      const origin: Vertex = [fields.width / 2 + across[0] * s, fields.height / 2 + across[1] * s];
      out += hatchLine(pen, fields, level, origin, along);
    }
  }
  return out;
}

function leaf(pen: Pen, x: number, y: number): string {
  const radius = 2.6 + pen.random() * 2.8;
  const tilt = (pen.random() - 0.5) * 0.9;
  const points: Vertex[] = [];
  for (let step = 0; step <= 4; step++) {
    const angle = Math.PI * (0.05 + 0.9 * (step / 4)) + tilt;
    points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.75]);
  }
  return pen.draw(pen.generator.curve(points, { disableMultiStroke: true, roughness: pen.roughness * 0.65, seed: pen.next() }));
}

function drawFoliage(pen: Pen, fields: SketchFields): string {
  let out = "";
  for (let y = 0; y < fields.height; y += 5) {
    for (let x = (y / 5) % 2 ? 0 : 3; x < fields.width; x += 6) {
      const px = x + (pen.random() - 0.5) * 5;
      const py = y + (pen.random() - 0.5) * 4;
      if (!fields.leafy(px, py)) continue;
      if (pen.random() > 0.15 + fields.tone(px, py) * 0.9) continue;
      out += leaf(pen, px, py);
    }
  }
  return out;
}

export { createPen, drawContours, drawFoliage, drawHatching };
export type { Pen };
