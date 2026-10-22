type Bounds = [number, number, number, number];

type Pen = { cx: number; cy: number; last: string; sx: number; sy: number; x: number; y: number };

type Segment = { command: string; values: number[] };

const COMMAND = /[ACHLMQSTVZ]/iu;

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/iuy;

const SIZES: Record<string, number> = { a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0 };

const TURN = Math.PI * 2;

function segmentsOf(d: string): Segment[] | null {
  const segments: Segment[] = [];
  let at = 0;
  while (at < d.length) {
    const letter = d.charAt(at);
    const current = segments[segments.length - 1];
    if (/[\s,]/u.test(letter)) at++;
    else if (COMMAND.test(letter)) {
      segments.push({ command: letter, values: [] });
      at++;
    } else if (!current) return null;
    else if (current.command.toLowerCase() === "a" && [3, 4].includes(current.values.length % 7) && /[01]/u.test(letter)) {
      current.values.push(Number(letter));
      at++;
    } else {
      NUMBER.lastIndex = at;
      const match = NUMBER.exec(d);
      if (!match) return null;
      current.values.push(Number(match[0]));
      at = NUMBER.lastIndex;
    }
  }
  return segments;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
}

function arcPoints(from: [number, number], args: number[], to: [number, number]): [number, number][] {
  const [rxIn = 0, ryIn = 0, rotation = 0, large = 0, sweep = 0] = args;
  if (!rxIn || !ryIn || (from [0] === to[0] && from [1] === to[1])) return [to];
  const phi = (rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const [hx, hy] = [(from [0] - to[0]) / 2, (from [1] - to[1]) / 2];
  const [x1, y1] = [cos * hx + sin * hy, -sin * hx + cos * hy];
  const grow = Math.max(1, Math.sqrt((x1 * x1) / (rxIn * rxIn) + (y1 * y1) / (ryIn * ryIn)));
  const [rx, ry] = [Math.abs(rxIn) * grow, Math.abs(ryIn) * grow];
  const spread = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - spread) / spread));
  const [ox, oy] = [(coef * rx * y1) / ry, (-coef * ry * x1) / rx];
  const [cx, cy] = [cos * ox - sin * oy + (from [0] + to[0]) / 2, sin * ox + cos * oy + (from [1] + to[1]) / 2];
  const start = vectorAngle(1, 0, (x1 - ox) / rx, (y1 - oy) / ry);
  let sweepAngle = vectorAngle((x1 - ox) / rx, (y1 - oy) / ry, (-x1 - ox) / rx, (-y1 - oy) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= TURN;
  if (sweep && sweepAngle < 0) sweepAngle += TURN;
  const xTurn = Math.atan2(-ry * sin, rx * cos);
  const yTurn = Math.atan2(ry * cos, rx * sin);
  const within = (angle: number) => {
    const travel = sweepAngle > 0 ? angle - start : start - angle;
    return ((travel % TURN) + TURN) % TURN <= Math.abs(sweepAngle);
  };
  const extremes = [xTurn, xTurn + Math.PI, yTurn, yTurn + Math.PI].filter(within);
  const point = (angle: number): [number, number] => [
    cx + rx * cos * Math.cos(angle) - ry * sin * Math.sin(angle),
    cy + rx * sin * Math.cos(angle) + ry * cos * Math.sin(angle),
  ];
  return [...extremes.map(point), to];
}

function reflected(pen: Pen, curves: string): [number, number] {
  return pen.last !== "" && curves.includes(pen.last) ? [2 * pen.x - pen.cx, 2 * pen.y - pen.cy] : [pen.x, pen.y];
}

function stepPoints(lower: string, args: number[], pen: Pen, relative: boolean): [number, number][] {
  const [ox, oy] = relative ? [pen.x, pen.y] : [0, 0];
  const at = (index: number): [number, number] => [ox + (args[index] ?? 0), oy + (args[index + 1] ?? 0)];
  if (lower === "h") return [[ox + (args[0] ?? 0), pen.y]];
  if (lower === "v") return [[pen.x, oy + (args[0] ?? 0)]];
  if (lower === "a") return arcPoints([pen.x, pen.y], args, at(5));
  if (lower === "c") return [at(0), at(2), at(4)];
  if (lower === "s") return [reflected(pen, "cs"), at(0), at(2)];
  if (lower === "q") return [at(0), at(2)];
  if (lower === "t") return [reflected(pen, "qt"), at(0)];
  return [at(0)];
}

function walk(segments: Segment[], add: (point: [number, number]) => void): boolean {
  const pen: Pen = { cx: 0, cy: 0, last: "", sx: 0, sy: 0, x: 0, y: 0 };
  for (const { command, values } of segments) {
    const lower = command.toLowerCase();
    const size = SIZES[lower] ?? 0;
    if (size === 0) {
      [pen.x, pen.y, pen.last] = [pen.sx, pen.sy, lower];
      continue;
    }
    if (values.length === 0 || values.length % size !== 0) return false;
    for (let index = 0; index < values.length; index += size) {
      const points = stepPoints(lower, values.slice(index, index + size), pen, command === lower);
      points.forEach(add);
      const end = points[points.length - 1] as [number, number];
      const control = points[points.length - 2] ?? end;
      if (lower === "t")[pen.cx, pen.cy] = points[0] as [number, number];
      else [pen.cx, pen.cy] = control;
      [pen.x, pen.y, pen.last] = [end[0], end[1], lower];
      if (lower === "m" && index === 0)[pen.sx, pen.sy] = end;
    }
  }
  return true;
}

function pathBounds(d: string): Bounds | null {
  const segments = segmentsOf(d);
  if (!segments) return null;
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const add = ([x, y]: [number, number]) => {
    [bounds[0], bounds[1]] = [Math.min(bounds[0], x), Math.min(bounds[1], y)];
    [bounds[2], bounds[3]] = [Math.max(bounds[2], x), Math.max(bounds[3], y)];
  };
  if (!walk(segments, add) || !Number.isFinite(bounds[0])) return null;
  return bounds;
}

export { pathBounds };
export type { Bounds };
