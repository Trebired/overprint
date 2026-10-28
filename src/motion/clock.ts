type Ticker = {
  measure: () => void;
  smooth: () => boolean;
  step: (now: number) => boolean;
};

type Pointer = { version: number; x: number; y: number };

const TICK_MS = 100;

const REST_MS = 3000;

const SCROLL_SETTLE_MS = 150;

const ACTIVITY = ["keydown", "pointermove", "scroll", "touchstart", "wheel"];

const tickers = new Set<Ticker>();

const wakers = new Set<()=>void>();

const pointer: Pointer = { version: 0, x: 0, y: 0 };

const clock = { frame: 0, lastActive: 0, scrollTimer: 0, scrollingUntil: 0, timer: 0 };

function scrolling(): boolean {
  return performance.now() < clock.scrollingUntil;
}

function restingSince(now: number): boolean {
  return now - clock.lastActive > REST_MS;
}

function run(now: number) {
  clock.frame = 0;
  clock.timer = 0;
  const active = [...tickers];
  active.forEach((ticker) => ticker.measure());
  active.forEach((ticker) => {
      if (!ticker.step(now)) tickers.delete(ticker);
  });
  schedule();
}

function schedule() {
  if (clock.frame || clock.timer || tickers.size === 0) return;
  if ([...tickers].some((ticker) => ticker.smooth())) {
    clock.frame = requestAnimationFrame(run);
    return;
  }
  const wait = TICK_MS - (performance.now() % TICK_MS);
  clock.timer = window.setTimeout(() => run(performance.now()), wait);
}

function startTicker(ticker: Ticker) {
  tickers.add(ticker);
  schedule();
}

function stopTicker(ticker: Ticker) {
  tickers.delete(ticker);
  if (tickers.size > 0) return;
  cancelAnimationFrame(clock.frame);
  window.clearTimeout(clock.timer);
  clock.frame = 0;
  clock.timer = 0;
}

function stir(event: Event) {
  clock.lastActive = performance.now();
  const move = event as PointerEvent;
  if (event.type === "pointermove" && move.pointerType !== "touch") {
    pointer.x = move.clientX;
    pointer.y = move.clientY;
    pointer.version++;
  }
  if (event.type === "scroll" || event.type === "wheel") {
    clock.scrollingUntil = clock.lastActive + SCROLL_SETTLE_MS;
    window.clearTimeout(clock.scrollTimer);
    clock.scrollTimer = window.setTimeout(() => wakers.forEach((wake) => wake()), SCROLL_SETTLE_MS + 10);
    return;
  }
  wakers.forEach((wake) => wake());
}

function watchActivity(wake: () => void): () => void {
  if (wakers.size === 0) for (const type of ACTIVITY) window.addEventListener(type, stir, { capture: true, passive: true });
  wakers.add(wake);
  clock.lastActive = performance.now();
  return () => {
    wakers.delete(wake);
    if (wakers.size === 0) for (const type of ACTIVITY) window.removeEventListener(type, stir, { capture: true });
  };
}

export { pointer, restingSince, scrolling, startTicker, stopTicker, TICK_MS, watchActivity };
export type { Ticker };
