import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

const SIDE = 240;

const CELL = 12;

const LEVELS = 15;

const GREY_ALPHA = 4;

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type Field = number[][];

function randomOf(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function soften(field: Field): Field {
  const side = field.length;
  const at = (x: number, y: number) => field[(y + side) % side]?.[(x + side) % side] ?? 0;
  return field.map((row, y) => row.map((_, x) => (at(x, y) * 4 + at(x + 1, y) + at(x - 1, y) + at(x, y + 1) + at(x, y - 1)) / 8));
}

function noise(side: number, passes: number, random: () => number): Field {
  let field: Field = Array.from({ length: side }, () => Array.from({ length: side }, random));
  for (let pass = 0; pass < passes; pass += 1) field = soften(field);
  const values = field.flat();
  const low = Math.min(...values);
  const span = Math.max(...values) - low;
  return field.map((row) => row.map((value) => (value - low) / span));
}

function sampled(field: Field, x: number, y: number): number {
  const side = field.length;
  const at = (column: number, row: number) => field[row % side]?.[column % side] ?? 0;
  const [left, top] = [Math.floor(x), Math.floor(y)];
  const [across, down] = [x - left, y - top];
  const upper = at(left, top) * (1 - across) + at(left + 1, top) * across;
  const lower = at(left, top + 1) * (1 - across) + at(left + 1, top + 1) * across;
  return upper * (1 - down) + lower * down;
}

function grainRows(): Buffer {
  const random = randomOf(11);
  const fine = noise(SIDE, 1, random);
  const mottle = noise(SIDE / CELL, 5, random);
  const rows = Buffer.alloc(SIDE * (SIDE * 2 + 1));
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      const speck = Math.max(0, 0.62 - (fine[y]?.[x] ?? 0));
      const density = 0.97 - 0.42 * speck - 0.1 * sampled(mottle, x / CELL, y / CELL);
      rows[y * (SIDE * 2 + 1) + 2 + x * 2] = Math.round(Math.round(density * LEVELS) / LEVELS * 255);
    }
  }
  return rows;
}

function crc(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = value&1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const named = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const length = Buffer.alloc(4);
  const check = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  check.writeUInt32BE(crc(named));
  return Buffer.concat([length, named, check]);
}

function grainPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIDE, 0);
  header.writeUInt32BE(SIDE, 4);
  header.set([8, GREY_ALPHA], 8);
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(grainRows(), { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function printGrainCss(): string {
  const image = `url("data:image/png;base64,${grainPng().toString("base64")}")`;
  return `@media (hover: none){[data-overprint]{mask:${image} 0 0/${SIDE}px ${SIDE}px;mask-clip:no-clip}[data-ink]{filter:none}}`;
}

export { printGrainCss };
