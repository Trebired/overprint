import { round } from "./../svg/node.js";
import { pointer, restingSince, scrolling, startTicker, stopTicker, TICK_MS, watchActivity, type Ticker } from "./clock.js";
import type { Plate, Point, Print } from "./../types.js";

type AnimateOptions = { drift?: boolean; pointer?: boolean };

type Layer = { element: SVGElement; plate: Plate; shown: string };

type Motion = {
  aim: { x: number; y: number };
  at: { x: number; y: number };
  elapsed: number;
  last: number;
  playing: boolean;
  running: boolean;
  seen: number;
  visible: boolean;
};

const EASE = 0.06;

function layersOf(root: Element, print: Print): Layer[] {
  const plates = print.plates.filter((plate) => !plate.hidden);
  const elements = [...root.children].filter((child): child is SVGElement => child.tagName.toLowerCase() === "svg");
  return elements.slice(0, plates.length).map((element, index) => ({ element, plate: plates[index] as Plate, shown: "" }));
}

function pullOf(plate: Plate, options: AnimateOptions): number {
  return options.pointer === false ? 0 : plate.motion?.pull ?? 0;
}

function driftOf(plate: Plate, options: AnimateOptions): number {
  return options.drift === false ? 0 : plate.motion?.drift ?? 0;
}

function shiftOf(plate: Plate, at: { x: number; y: number }, time: number, options: AnimateOptions): Point {
  const [x, y] = plate.offset || [0, 0];
  const pull = pullOf(plate, options);
  const phase = (time / 2.2) * driftOf(plate, options);
  return [x + at.x * pull + Math.sin(phase) * 2, y + at.y * pull + Math.sin(phase * 0.7) * 1.5];
}

function playSvg(element: SVGElement, playing: boolean) {
  const svg = element as SVGSVGElement;
  if (typeof svg.pauseAnimations !== "function") return;
  if (playing) svg.unpauseAnimations();
  else svg.pauseAnimations();
}

function settled(motion: Motion): boolean {
  return Math.abs(motion.aim.x - motion.at.x) < 0.002 && Math.abs(motion.aim.y - motion.at.y) < 0.002;
}

function aimAt(root: Element, motion: Motion) {
  if (motion.seen === pointer.version) return;
  motion.seen = pointer.version;
  const box = root.getBoundingClientRect();
  motion.aim.x = Math.max(-1, Math.min(1, ((pointer.x - box.left - box.width / 2) / window.innerWidth) * 2));
  motion.aim.y = Math.max(-1, Math.min(1, ((pointer.y - box.top - box.height / 2) / window.innerHeight) * 2));
}

function place(moving: Layer[], motion: Motion, options: AnimateOptions, smooth: boolean) {
  const time = (smooth ? motion.elapsed : Math.floor(motion.elapsed / TICK_MS) * TICK_MS) / 1000;
  for (const layer of moving) {
    const [x, y] = shiftOf(layer.plate, motion.at, time, options);
    const transform = `translate(${round(x)}px,${round(y)}px)`;
    if (transform === layer.shown) continue;
    layer.shown = transform;
    layer.element.style.transform = transform;
  }
}

function tickerOf(root: Element, layers: Layer[], moving: Layer[], motion: Motion, options: AnimateOptions): Ticker {
  const pulls = moving.some((layer) => pullOf(layer.plate, options) !== 0);
  const play = (playing: boolean) => {
    if (motion.playing !== playing) layers.forEach(({ element }) => playSvg(element, playing));
    motion.playing = playing;
  };
  return {
    measure: () => {
      if (pulls) aimAt(root, motion);
    },
    smooth: () => !settled(motion) || (pulls && motion.seen !== pointer.version),
    step: (now) => {
      motion.elapsed += Math.min(100, now - motion.last);
      motion.last = now;
      const smooth = !settled(motion);
      if (smooth) {
        motion.at.x += (motion.aim.x - motion.at.x) * EASE;
        motion.at.y += (motion.aim.y - motion.at.y) * EASE;
      }
      place(moving, motion, options, smooth);
      const resting = scrolling() || (restingSince(now) && settled(motion));
      play(motion.visible && !resting);
      motion.running = motion.visible && !resting;
      return motion.running;
    },
  };
}

function animatePrint(root: Element | null, print: Print, options: AnimateOptions = {}): () => void {
  if (!root || typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return () => undefined;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  const layers = layersOf(root, print);
  const moving = layers.filter((layer) => pullOf(layer.plate, options) !== 0 || driftOf(layer.plate, options) !== 0);
  if (moving.length === 0 && !layers.some((layer) => layer.plate.wave)) return () => undefined;
  const motion: Motion = {
    aim: { x: 0, y: 0 },
    at: { x: 0, y: 0 },
    elapsed: 0,
    last: 0,
    playing: true,
    running: false,
    seen: pointer.version,
    visible: true,
  };
  return bindPrint(root, moving, motion, tickerOf(root, layers, moving, motion, options));
}

function bindPrint(root: Element, moving: Layer[], motion: Motion, ticker: Ticker): () => void {
  const wake = () => {
    if (motion.running || !motion.visible || scrolling()) return;
    motion.last = performance.now();
    motion.running = true;
    startTicker(ticker);
  };
  const watcher = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      motion.visible = entries.some((entry) => entry.isIntersecting);
      if (motion.visible) wake();
  });
  watcher?.observe(root);
  const unwatch = watchActivity(wake);
  for (const { element } of moving) element.style.willChange = "transform";
  motion.last = performance.now();
  motion.running = true;
  startTicker(ticker);
  return () => {
    stopTicker(ticker);
    motion.running = false;
    watcher?.disconnect();
    unwatch();
    for (const { element } of moving) element.style.willChange = "";
  };
}

export { animatePrint };
export type { AnimateOptions };
