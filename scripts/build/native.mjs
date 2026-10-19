import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const crateDir = path.join(rootDir, "native");
const target = "wasm32-unknown-unknown";
const wasmPath = path.join(crateDir, "target", target, "release", "overprint_kernels.wasm");
const outDir = path.join(rootDir, "dist", "native");
const PLACEHOLDER = "@trebired/overprint:wasm";

function compile() {
  try {
    execFileSync("cargo", ["build", "--release", "--quiet", "--target", target, "--manifest-path", path.join(crateDir, "Cargo.toml")], {
        stdio: "inherit",
    });
  } catch (error) {
    throw new Error(`cargo could not build the ${target} kernels; install Rust and run "rustup target add ${target}" (${error.message})`);
  }
}

async function embed() {
  const wasm = await fs.readFile(wasmPath);
  const loader = path.join(outDir, "kernels.js");
  const source = await fs.readFile(loader, "utf8");
  if (!source.includes(PLACEHOLDER)) throw new Error(`${loader} carries no kernel placeholder`);
  await fs.writeFile(loader, source.replace(PLACEHOLDER, wasm.toString("base64")));
  return wasm.length;
}

compile();
const size = await embed();
process.stdout.write(`native kernels: ${size} bytes embedded into dist/native/kernels.js\n`);
