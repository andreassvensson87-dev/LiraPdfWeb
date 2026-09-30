import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const destination = resolve(import.meta.dirname, "../public/pdfjs");
await mkdir(destination, { recursive: true });
for (const name of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(resolve(source, name), resolve(destination, name), {
    recursive: true,
  });
}
