import type { Pixels, Rgb } from "./../types.js";

type Kernels = {
  coverage: (width: number, height: number) => void;
  dither: (width: number, height: number, mode: number, threshold: number) => void;
  memory: WebAssembly.Memory;
  release: () => void;
  reserve: (length: number) => number;
  separate: (width: number, height: number, channel: number) => void;
  tint: (red: number, green: number, blue: number) => void;
};

const WASM = "@trebired/overprint:wasm";

let ready: Kernels | null = null;
let pending: Promise<Kernels>|null = null;

function bytes(): Uint8Array<ArrayBuffer> {
  if (WASM.startsWith("@")) throw new Error("@trebired/overprint: this copy was built without its kernels; run bun run build");
  const raw = atob(WASM);
  const out = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) out[index] = raw.charCodeAt(index);
  return out;
}

function adopt(instance: WebAssembly.Instance): Kernels {
  ready = instance.exports as unknown as Kernels;
  return ready;
}

function prepareKernels(): Promise<void> {
  if (ready) return Promise.resolve();
  pending ??= WebAssembly.instantiate(bytes()).then(({ instance }) => adopt(instance));
  return pending.then(() => undefined);
}

function kernels(): Kernels {
  if (ready) return ready;
  try {
    return adopt(new WebAssembly.Instance(new WebAssembly.Module(bytes())));
  } catch (error) {
    throw new Error(`@trebired/overprint: the pixel kernels could not start synchronously; await prepareKernels() first (${String(error)})`);
  }
}

function runKernel(pixels: Pixels, ink: Rgb, work: (kernels: Kernels) => void): Pixels {
  const native = kernels();
  const length = pixels.width * pixels.height * 4;
  if (pixels.data.length < length) throw new Error("@trebired/overprint: pixel data is shorter than width * height * 4");
  const pointer = native.reserve(length);
  new Uint8Array(native.memory.buffer, pointer, length).set(pixels.data.subarray(0, length));
  native.tint(ink[0], ink[1], ink[2]);
  work(native);
  const data = new Uint8ClampedArray(length);
  data.set(new Uint8Array(native.memory.buffer, pointer, length));
  return { data, height: pixels.height, width: pixels.width };
}

function releaseKernels() {
  ready?.release();
}

export { prepareKernels, releaseKernels, runKernel };
