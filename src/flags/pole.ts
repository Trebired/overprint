import type { Paper, Print } from "./../types.js";

const POLE = "M2 6A3 3 0 0 1 8 6V200H2Z";

function polePrint(paper: Paper = "light"): Print {
  const art = { d: POLE, fit: "fill"as const, kind: "path"as const, viewBox: [10, 200] as const };
  return {
    paper,
    plates: [
      { art, ink: "#9a9a9a", name: "pole", offset: [1.5, 1], tone: { kind: "flat", level: 0.9 } },
      { art, ink: "#3c3c3c", name: "pole-line", screen: { angle: 90, cells: 60, dot: "line", kind: "halftone" }, tone: { kind: "flat", level: 0.6 } },
    ],
    size: [40, 800],
  };
}

export { polePrint };
