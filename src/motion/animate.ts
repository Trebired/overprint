import { round } from "./../svg/node.js";
import type { Plate, Point, Print } from "./../types.js";

type AnimateOptions = { drift?: boolean; pointer?: boolean };

type Layer = { element: SVGElement; plate: Plate };

const EASE = 0.06;

function layersOf(root: Element, print: Print): Layer[] {
  const plates = print.plates.filter((plate) => !plate.hidden);
  const elements = [...root.children].filter((child): child is SVGElement => child.tagName.toLowerCase() === "svg");
  return elements.slice(0, plates.length).map((element, index) => ({ element, plate: plates[index] as Plate }));
}

function shiftOf(plate: Plate, at: { x: number; y: number }, time: number, options: AnimateOptions): Point {
  const [x, y] = plate.offset || [0, 0];
  const pull = options.pointer === false ? 0 : plate.motion?.pull ?? 0;
  const drift = options.drift === false ? 0 : plate.motion?.drift ?? 0;
  const phase = (time / 2.2) * drift;
  return [x + at.x * pull + Math.sin(phase) * 2, y + at.y * pull + Math.cos(phase) * 1.5];
}

function animatePrint(root: Element | null, print: Print, options: AnimateOptions = {}): () => void {
  if (!root || typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return () => undefined;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  const layers = layersOf(root, print);
  if (layers.length === 0) return () => undefined;
  const aim = { x: 0, y: 0 };
  const at = { x: 0, y: 0 };
  const begun = performance.now();
  let frame = 0;
  let visible = true;
  const step = () => {
    at.x += (aim.x - at.x) * EASE;
    at.y += (aim.y - at.y) * EASE;
    const time = (performance.now() - begun) / 1000;
    for (const { element, plate } of layers) {
      const [x, y] = shiftOf(plate, at, time, options);
      element.style.transform = `translate(${round(x)}px,${round(y)}px)`;
    }
    frame = visible ? requestAnimationFrame(step) : 0;
  };
  const point = (event: PointerEvent) => {
    const box = root.getBoundingClientRect();
    aim.x = Math.max(-1, Math.min(1, ((event.clientX - box.left - box.width / 2) / window.innerWidth) * 2));
    aim.y = Math.max(-1, Math.min(1, ((event.clientY - box.top - box.height / 2) / window.innerHeight) * 2));
  };
  const watcher = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !frame) frame = requestAnimationFrame(step);
  });
  watcher?.observe(root);
  for (const { element } of layers) element.style.willChange = "transform";
  if (options.pointer !== false) window.addEventListener("pointermove", point, { passive: true });
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    watcher?.disconnect();
    window.removeEventListener("pointermove", point);
    for (const { element } of layers) element.style.willChange = "";
  };
}

export { animatePrint };
export type { AnimateOptions };
