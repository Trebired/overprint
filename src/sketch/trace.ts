import type { SketchFields } from "./fields.js";

type Vertex = [number, number];

const MIN_CHAIN = 14;

const MIN_SPAN = 10;

function neighbours(width: number): number[] {
  return [1, width + 1, width, width - 1, -1, -width - 1, -width, -width + 1];
}

function span(points: Vertex[]): number {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function walk(fields: SketchFields, seen: Uint8Array, start: number): number[] {
  const steps = neighbours(fields.width);
  const total = fields.width * fields.height;
  const chain = [start];
  seen[start] = 1;
  let current = start;
  for (;; ) {
    const next = steps.map((step) => current + step).find((index) => index > 0 && index < total && fields.edge(index) && !seen[index]);
    if (next === undefined) return chain;
    seen[next] = 1;
    chain.push(next);
    current = next;
  }
}

function traceChains(fields: SketchFields): Vertex[][] {
  const total = fields.width * fields.height;
  const seen = new Uint8Array(total);
  const chains: Vertex[][] = [];
  for (let index = 0; index < total; index++) {
    if (!fields.edge(index) || seen[index]) continue;
    const ahead = walk(fields, seen, index);
    const behind = walk(fields, seen, index).slice(1).reverse();
    const ids = [...behind, ...ahead];
    if (ids.length < MIN_CHAIN) continue;
    const points: Vertex[] = ids.map((id) => [id % fields.width, Math.floor(id / fields.width)]);
    if (span(points) >= MIN_SPAN) chains.push(points);
  }
  return chains;
}

function simplify(points: Vertex[], tolerance: number): Vertex[] {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay) || 1;
  let farthest = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const [px, py] = points[index];
    const distance = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / length;
    if (distance > farthest) {
      farthest = distance;
      split = index;
    }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplify(points.slice(split), tolerance)];
}

export { simplify, traceChains };
export type { Vertex };
