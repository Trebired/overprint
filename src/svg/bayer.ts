import { el, round, type OverprintNode } from "./node.js";

function level(column: number, row: number): number {
  const mixed = column ^ row;
  let value = 0;
  for (let bit = 0; bit < 3; bit++) value = (value<<2) | (((mixed >> bit)&1)<<1) | ((row >> bit)&1);
  return value;
}

function bayer(id: string, grain: number): OverprintNode {
  const size = round(Math.max(0.5, grain));
  const cells: OverprintNode[] = [];
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const red = Math.round(((level(column, row) + 0.5) / 64) * 255).toString(16).padStart(2, "0");
      cells.push(el("rect", { fill: `#${red}0000`, height: size, width: size, x: round(column * size), y: round(row * size) }));
    }
  }
  return el("pattern", { height: round(size * 8), id, patternUnits: "userSpaceOnUse", width: round(size * 8) }, cells);
}

export { bayer };
