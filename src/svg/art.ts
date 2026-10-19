import { el, percent, raw, round, type OverprintNode } from "./node.js";
import type { Align, Art, Box, Fit, GroupArt, Placement, TextArt } from "./../types.js";

const ALIGN: Record<Align, string> = { center: "Mid", end: "Max", start: "Min" };

function boxOf(box: Box = {}) {
  return { height: box.height ?? 1, width: box.width ?? 1, x: box.x ?? 0, y: box.y ?? 0 };
}

function aspect(fit: Fit = "meet", align: Align = "center"): string {
  if (fit === "fill") return "none";
  return `x${ALIGN[align]}Y${ALIGN[align]} ${fit}`;
}

function turn(degrees: number | undefined, originX: number, originY: number): string | undefined {
  if (!degrees) return undefined;
  return `transform-box:view-box;transform-origin:${percent(originX)} ${percent(originY)};transform:rotate(${round(degrees)}deg)`;
}

function placed(placement: Placement, child: OverprintNode): OverprintNode {
  const box = boxOf(placement.box);
  const style = turn(placement.rotate, box.x + box.width / 2, box.y + box.height / 2);
  return style ? el("g", { style }, [child]) : child;
}

function frame(placement: Placement, viewBox: string, children: OverprintNode[] | string): OverprintNode {
  const box = boxOf(placement.box);
  const attrs = {
    height: percent(box.height),
    overflow: "visible",
    preserveAspectRatio: aspect(placement.fit, placement.align),
    viewBox,
    width: percent(box.width),
    x: percent(box.x),
    y: percent(box.y),
  };
  return typeof children === "string" ? raw("svg", attrs, children) : el("svg", attrs, children);
}

function text(art: TextArt): OverprintNode {
  return el("text", {
      "dominant-baseline": "central",
      "font-size": art.size || "1em",
      "text-anchor": art.anchor || "start",
      x: percent(art.x ?? 0),
      y: percent(art.y ?? 0.5),
    }, [art.text]);
}

function group(art: GroupArt): OverprintNode {
  return el("g", { style: turn(art.rotate, 0.5, 0.5) }, art.parts.map(artNode));
}

function artNode(art: Art): OverprintNode {
  if (art.kind === "fill") return el("rect", { height: "100%", width: "100%" });
  if (art.kind === "text") return text(art);
  if (art.kind === "group") return group(art);
  if (art.kind === "image") {
    const box = boxOf(art.box);
    const image = el("image", {
        height: percent(box.height),
        href: art.href,
        preserveAspectRatio: aspect(art.fit, art.align),
        width: percent(box.width),
        x: percent(box.x),
        y: percent(box.y),
    });
    return placed(art, image);
  }
  if (art.kind === "svg") return placed(art, frame(art, art.viewBox, art.markup));
  const [width, height] = art.viewBox || [1, 1];
  return placed(art, frame(art, `0 0 ${width} ${height}`, [el("path", { d: art.d, "fill-rule": art.rule || "nonzero" })]));
}

export { artNode };
