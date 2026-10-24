import type { Art, Print } from "./../types.js";

function covers(art: Art): boolean {
  return art.kind === "fill";
}

function assertSingle(count: number): void {
  if (count === 1) return;
  throw new Error(`@trebired/overprint: a single sheet prints exactly one visible plate, got ${count}; drop \`single\` to overprint`);
}

function assertOverprint(print: Print): void {
  const visible = (print.plates || []).filter((plate) => !plate.hidden);
  if (print.single) return assertSingle(visible.length);
  if (visible.length < 2) {
    const got = `got ${visible.length}`;
    const fix = "pass `single: true` to print one ink on its own";
    throw new Error(`@trebired/overprint: a print needs at least two visible plates, ${got}; one ink alone is not an overprint; ${fix}`);
  }
  if (visible.some((plate) => covers(plate.art))) return;
  const seen = new Set<string>();
  for (const plate of visible) {
    const key = JSON.stringify(plate.art);
    if (seen.has(key)) return;
    seen.add(key);
  }
  const fix = "give at least two plates the same art or one a fill";
  throw new Error(`@trebired/overprint: no two plates print the same art, so no ink lands on another; ${fix}`);
}

export { assertOverprint };
