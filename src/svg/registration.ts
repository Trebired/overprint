import { round } from "./node.js";

const FULL_AT = 1200;

const FLOOR = 0.5;

function fluidOf(value: number): string {
  if (value === 0) return "0px";
  const [low, high] = [Math.min(value, value * FLOOR), Math.max(value, value * FLOOR)];
  return `clamp(${round(low)}px, ${round((value / FULL_AT) * 100)}vw, ${round(high)}px)`;
}

function registered(value: number, extra = 0): string {
  const fluid = fluidOf(value);
  return extra === 0 ? fluid : `calc(${fluid} + ${round(extra)}px)`;
}

function registeredShift([x, y]: readonly [number, number], extra: readonly [number, number] = [0, 0]): string {
  return `translate(${registered(x, extra[0])},${registered(y, extra[1])})`;
}

export { registered, registeredShift };
