import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectModule,
  verifyArchitecture,
} from "../scripts/source-architecture.mjs";

test("architecture parsing includes static imports, reexports and literal dynamic imports", () => {
  assert.deepEqual(
    inspectModule(
      'import "./a.js"; export { x } from "./b.js"; export * from "./c.js"; const load = () => import("./d.js");',
    ),
    ["./a.js", "./b.js", "./c.js", "./d.js"],
  );
  assert.throws(() => inspectModule("import(name)"), /uttrycklig/);
});

test("DOM-free modules and UI storage boundaries reject hidden browser access", () => {
  assert.throws(
    () =>
      inspectModule('globalThis["document"].querySelector("main")', {
        domFree: true,
      }),
    /Browserberoende/,
  );
  assert.throws(
    () => inspectModule('localStorage.getItem("x")', { storageFree: true }),
    /browserlagring/,
  );
  assert.doesNotThrow(() =>
    inspectModule('const record = { document: "name" }; record.document;', {
      domFree: true,
    }),
  );
});

test("cycles and forbidden reexport dependencies fail the real architecture validator", () => {
  const sources = new Map([
    ["src/a.js", 'export * from "./b.js"'],
    ["src/b.js", 'import "./a.js"'],
  ]);
  const registry = {
    layers: { model: { files: [...sources.keys()], mayImport: ["model"] } },
  };
  assert.throws(() => verifyArchitecture(sources, registry), /Cirkulärt/);
  registry.layers.model.files = ["src/a.js"];
  registry.layers.ui = { files: ["src/b.js"], mayImport: ["model"] };
  assert.throws(() => verifyArchitecture(sources, registry), /Otillåtet/);
});
