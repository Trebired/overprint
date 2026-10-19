import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLogger } from "@package/logger-adapter";

const log = resolveLogger({ source: "@trebired/overprint" });

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const overprint = await import(path.join(rootDir, "dist", "index.js"));

const failures = [];

function check(name, condition, detail = "") {
  if (condition) return;
  failures.push(detail ? `${name}: ${detail}` : name);
}

function ramp(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    const value = Math.round(((index % width) / (width - 1)) * 255);
    data.set([value, value, value, 255], index * 4);
  }
  return { data, height, width };
}

function solid(rgba, width = 4, height = 4) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) data.set(rgba, index * 4);
  return { data, height, width };
}

const share = (pixels) => {
  let inked = 0;
  for (let index = 3; index < pixels.data.length; index += 4) if (pixels.data[index] === 255) inked++;
  return inked / (pixels.width * pixels.height);
};

function verifyInks() {
  check("ink table carries the standard blue", overprint.inks.blue.join() === "0,120,191", overprint.inks.blue.join());
  check("ink names resolve", overprint.inkOf("fluorescentPink").join() === "255,72,176");
  check("short hex resolves", overprint.inkOf("#abc").join() === "170,187,204");
  check("rgb input clamps", overprint.inkOf([300, -4, 2.4]).join() === "255,0,2");
  let refused = false;
  try {
    overprint.inkOf("not-an-ink");
  } catch {
    refused = true;
  }
  check("unknown inks are refused", refused);
}

function verifyCoverage() {
  const tone = ramp(32, 2);
  const covered = overprint.coverage(tone, { ink: "blue" });
  check("coverage leaves the source untouched", tone.data[3] === 255 && tone.data[0] === 0);
  check("black becomes full coverage", covered.data[3] === 255, String(covered.data[3]));
  check("white becomes no coverage", covered.data[31 * 4 + 3] === 0, String(covered.data[31 * 4 + 3]));
  check("coverage is tinted with the ink", [...covered.data.slice(0, 3)].join() === "0,120,191");
  const clear = overprint.coverage(solid([0, 0, 0, 0]));
  check("transparent pixels carry no ink", clear.data[3] === 0);
}

function verifyDither() {
  const flat = solid([128, 128, 128, 255], 8, 8);
  check("threshold inks a grey darker than the cut", share(overprint.dither(flat, { mode: "threshold", threshold: 129 })) === 1);
  check("threshold leaves a grey lighter than the cut", share(overprint.dither(flat, { mode: "threshold", threshold: 127 })) === 0);
  for (const mode of ["atkinson", "floyd-steinberg", "bayer"]) {
    const grey = overprint.dither(solid([128, 128, 128, 255], 64, 64), { mode });
    check(`${mode} keeps mid grey near half coverage`, Math.abs(share(grey) - 0.5) < 0.1, String(share(grey)));
    const binary = [...grey.data].every((value, index) => index % 4 !== 3 || value === 0 || value === 255);
    check(`${mode} prints only full dots`, binary);
  }
  const dark = overprint.dither(ramp(128, 16), { mode: "atkinson", threshold: 200 });
  const light = overprint.dither(ramp(128, 16), { mode: "atkinson", threshold: 60 });
  check("a higher threshold inks more", share(dark) > share(light), `${share(dark)} vs ${share(light)}`);
}

function verifySeparation() {
  const cyan = solid([0, 255, 255, 255]);
  check("cyan lands on the cyan drum", overprint.separate(cyan, "cyan").data[3] === 255);
  check("cyan leaves the magenta drum empty", overprint.separate(cyan, "magenta").data[3] === 0);
  check("black lands on the key drum", overprint.separate(solid([0, 0, 0, 255]), "black").data[3] === 255);
  check("red channel reads intensity", overprint.separate(solid([255, 0, 0, 255]), "red").data[3] === 255);
}

function verifyPrintWithoutCanvas() {
  const print = overprint.createPrint({ height: 10, width: 10 });
  let message = "";
  try {
    print.plate("blue");
  } catch (error) {
    message = String(error.message);
  }
  check("a print without a canvas names the surface option", message.includes("surface factory"), message);
}

await overprint.prepareKernels();
verifyInks();
verifyCoverage();
verifyDither();
verifySeparation();
verifyPrintWithoutCanvas();

if (failures.length > 0) {
  for (const failure of failures) log.error("verify.overprint", failure);
  process.exit(1);
}

log.info("verify.overprint", "Overprint verification succeeded.");
