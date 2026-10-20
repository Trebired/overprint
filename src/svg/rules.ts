import type { Art, Print } from "./../types.js";

function covers(art: Art): boolean {
  return art.kind === "fill";
}

function assertOverprint(print: Print): void {
  const visible = (print.plates || []).filter((plate) => !plate.hidden);
  if (visible.length < 2) {
    const got = `got ${visible.length}`;
    throw new Error(`@trebired/overprint: a print needs at least two visible plates, ${got}; one ink alone is not an overprint`);
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
