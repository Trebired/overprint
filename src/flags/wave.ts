type FlagWaveOptions = { amplitude?: number; paper?: "dark" | "light"; period?: number; shade?: number; strips?: number; waves?: number };

type Wave = Required<Omit<FlagWaveOptions, "paper">>& { paper: "dark" | "light" };

type Box = { height: number; width: number };

type Strip = { element: HTMLElement; shade: HTMLElement };

type WaveState = {
  animations: Animation[];
  field: HTMLElement | null;
  near?: IntersectionObserver;
  started: boolean;
  stopped: boolean;
  watch?: IntersectionObserver;
};

const DEFAULTS: Wave = { amplitude: 0.035, paper: "light", period: 2.6, shade: 0.22, strips: 48, waves: 1.3 };

const MAX_SCALE = 2;

const NEAR = "100% 0px";

const BAKE_ATTR = "data-overprint-bake";

const bakes = new Map<string, Promise<string>>();

const painted = new Map<string, string|null>();

const sheet: { rules: CSSStyleSheet | null; ready: boolean } = { rules: null, ready: false };

function borrowShared(copy: SVGSVGElement, layer: SVGSVGElement) {
  const missing = [...copy.querySelectorAll("use")]
  .map((use) => (use.getAttribute("href") || "").slice(1))
  .filter((ref, index, refs) => ref && refs.indexOf(ref) === index && !copy.querySelector(`[id="${ref}"]`));
  const found = missing.map((ref) => layer.ownerDocument.getElementById(ref)).filter((node): node is HTMLElement => node !== null);
  if (found.length === 0) return;
  const defs = layer.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.append(...found.map((node) => node.cloneNode(true)));
  copy.prepend(defs);
}

function layerHref(layer: SVGSVGElement, box: Box): string {
  const copy = layer.cloneNode(true) as SVGSVGElement;
  borrowShared(copy, layer);
  copy.setAttribute("width", String(box.width));
  copy.setAttribute("height", String(box.height));
  copy.removeAttribute("style");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
}

function decoded(href: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = href;
  return image.decode().then(() => image);
}

function offsetOf(layer: SVGSVGElement): [number, number] {
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/u.exec(layer.style.transform || "");
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

function encoded(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise<Blob|null>((resolve) => canvas.toBlob(resolve, "image/png")).then((blob) => new Promise<string>((resolve, reject) => {
        if (!blob) throw new Error("@trebired/overprint: the flag bitmap could not be encoded");
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
  }));
}

async function render(hrefs: string[], offsets: [number, number][], box: Box, paper: Wave["paper"]): Promise<string> {
  const scale = Math.min(MAX_SCALE, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("@trebired/overprint: no 2D canvas to bake the flag into");
  const images = await Promise.all(hrefs.map(decoded));
  context.globalCompositeOperation = paper === "dark" ? "screen" : "multiply";
  images.forEach((image, index) => {
      const [x, y] = offsets[index] as [number, number];
      context.drawImage(image, x * scale, y * scale, canvas.width, canvas.height);
  });
  return encoded(canvas);
}

function bake(root: HTMLElement, box: Box, paper: Wave["paper"]): Promise<string> {
  const layers = [...root.children].filter((child): child is SVGSVGElement => child instanceof SVGSVGElement);
  const hrefs = layers.map((layer) => layerHref(layer, box));
  const offsets = layers.map(offsetOf);
  const key = [box.width, box.height, window.devicePixelRatio || 1, paper, JSON.stringify(offsets), ...hrefs].join("|");
  const known = bakes.get(key);
  if (known) return known;
  const fresh = render(hrefs, offsets, box, paper);
  bakes.set(key, fresh);
  fresh.catch (() => bakes.delete(key));
  return fresh;
}

function sharedSheet(): CSSStyleSheet | null {
  if (sheet.ready) return sheet.rules;
  sheet.ready = true;
  try {
    sheet.rules = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet.rules];
  } catch {
    sheet.rules = null;
  }
  return sheet.rules;
}

function paintRule(href: string): string | null {
  const rules = sharedSheet();
  if (!rules) return null;
  const id = String(rules.cssRules.length);
  rules.insertRule(`[${BAKE_ATTR}="${id}"]>span{background-image:url("${href}")}`, rules.cssRules.length);
  return id;
}

function stripOf(index: number, href: string | null, wave: Wave): Strip {
  const element = document.createElement("span");
  const along = index / (wave.strips - 1);
  const style = element.style;
  style.cssText = "position:absolute;top:0;height:100%;will-change:transform;background-repeat:no-repeat";
  style.left = `${(index / wave.strips) * 100}%`;
  style.width = `calc(${100 / wave.strips}% + 1px)`;
  if (href) style.backgroundImage = `url("${href}")`;
  style.backgroundSize = `${wave.strips * 100}% 100%`;
  style.backgroundPosition = `${along * 100}% 0`;
  const shade = document.createElement("span");
  shade.style.cssText = "position:absolute;inset:0;background:#000;opacity:0;will-change:opacity";
  element.append(shade);
  return { element, shade };
}

function animateStrip(strip: Strip, index: number, height: number, wave: Wave): Animation[] {
  const along = index / (wave.strips - 1);
  const lift = wave.amplitude * height * along;
  const timing: KeyframeAnimationOptions = {
    delay: -along * wave.waves * wave.period * 1000,
    direction: "alternate",
    duration: (wave.period * 1000) / 2,
    easing: "ease-in-out",
    iterations: Infinity,
  };
  return [
    strip.element.animate([{ transform: `translateY(${-lift}px)` }, { transform: `translateY(${lift}px)` }], timing),
    strip.shade.animate([{ opacity: 0 }, { opacity: wave.shade * along }], timing),
  ];
}

function show(root: HTMLElement, href: string, box: Box, wave: Wave, state: WaveState) {
  if (!painted.has(href)) painted.set(href, paintRule(href));
  const rule = painted.get(href) ?? null;
  const field = document.createElement("span");
  field.setAttribute("aria-hidden", "true");
  if (rule) field.setAttribute(BAKE_ATTR, rule);
  field.style.cssText = "position:absolute;inset:0;pointer-events:none";
  for (let index = 0; index < wave.strips; index++) {
    const strip = stripOf(index, rule ? null : href, wave);
    field.append(strip.element);
    state.animations.push(...animateStrip(strip, index, box.height, wave));
  }
  root.append(field);
  state.field = field;
  for (const layer of root.children) if (layer instanceof SVGSVGElement) layer.style.visibility = "hidden";
  state.watch = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      state.animations.forEach((animation) => (visible ? animation.play() : animation.pause()));
  });
  state.watch.observe(root);
}

function start(root: HTMLElement, rect: Box, wave: Wave, state: WaveState) {
  state.started = true;
  state.near?.disconnect();
  const box = { height: Math.max(1, Math.round(rect.height)), width: Math.max(1, Math.round(rect.width)) };
  void bake(root, box, wave.paper).then((href) => {
      if (!state.stopped) show(root, href, { height: rect.height, width: rect.width }, wave, state);
  }).catch (() => undefined);
}

function waveFlag(root: HTMLElement | null, options: FlagWaveOptions = {}): () => void {
  if (!root || typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  const wave: Wave = { ...DEFAULTS, ...options };
  const state: WaveState = { animations: [], field: null, started: false, stopped: false };
  if (typeof IntersectionObserver === "undefined") start(root, root.getBoundingClientRect(), wave, state);
  else {
    state.near = new IntersectionObserver((entries) => {
        const near = entries.find((entry) => entry.isIntersecting);
        if (near && !state.started) start(root, near.boundingClientRect, wave, state);
      }, { rootMargin: NEAR });
    state.near.observe(root);
  }
  return () => {
    state.stopped = true;
    state.near?.disconnect();
    state.watch?.disconnect();
    state.animations.forEach((animation) => animation.cancel());
    state.field?.remove();
    for (const layer of root.children) if (layer instanceof SVGSVGElement) layer.style.visibility = "";
  };
}

export { waveFlag };
export type { FlagWaveOptions };
