import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setupFileHandling } from "../src/file-handling.js";

const handle = (name, value = 37) => ({
  getFile: async () => ({
    name,
    arrayBuffer: async () => Uint8Array.of(value).buffer,
  }),
});
function harness(options = {}) {
  let consume;
  const opened = [],
    errors = [];
  setupFileHandling({
    launchQueue: {
      setConsumer: (callback) => {
        consume = callback;
      },
    },
    canOpen: () => true,
    open: async (bytes, name) => opened.push({ bytes: [...bytes], name }),
    error: (e) => errors.push(e.message),
    ...options,
  });
  return { launch: (files) => consume({ files }), opened, errors };
}

test("PDF file association stays inside the installed app scope", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/manifest.webmanifest", import.meta.url)),
  );
  const handler = manifest.file_handlers[0];
  for (const base of [
    "https://example.org/",
    "https://example.org/LiraPdfWeb/",
  ]) {
    assert.equal(new URL(handler.action, base).href, base);
  }
  assert.deepEqual(handler.accept, { "application/pdf": [".pdf"] });
  assert.equal(handler.launch_type, "single-client");
  // Repeated OS launches must reuse the running app without reloading its tabs.
  assert.equal(manifest.launch_handler.client_mode, "focus-existing");
});

test("browsers without file handling keep working", () => {
  assert.equal(setupFileHandling({ launchQueue: undefined }), false);
});

test("OS launches retain the original file handle for saving back to the same PDF", async () => {
  const source = handle("Test.pdf");
  let received;
  const h = harness({
    open: async (_, name, fileHandle) => {
      received = { name, fileHandle };
    },
  });
  await h.launch([source]);
  assert.equal(received.fileHandle, source);
  assert.equal(received.name, "Test.pdf");
});

test("launch waits for restoration and serializes multiple launch events", async () => {
  let restored;
  const ready = new Promise((resolve) => {
    restored = resolve;
  });
  const h = harness({ ready });
  const first = h.launch([
    handle("Ritning 1.pdf"),
    handle("Ritning 2.PDF", 38),
  ]);
  const second = h.launch([handle("Ritning 3.pdf", 39)]);
  await Promise.resolve();
  assert.deepEqual(h.opened, []);
  restored();
  await Promise.all([first, second]);
  assert.deepEqual(
    h.opened.map((f) => f.name),
    ["Ritning 1.pdf", "Ritning 2.PDF", "Ritning 3.pdf"],
  );
  assert.deepEqual(
    h.opened.map((f) => f.bytes),
    [[37], [38], [39]],
  );
});

test("launch retains files while a command or dialog is active", async () => {
  let busy = true,
    notices = 0,
    waits = 0;
  const h = harness({
    canOpen: () => !busy,
    waiting: () => {
      notices++;
    },
    wait: async () => {
      waits++;
      busy = false;
    },
  });
  await h.launch([handle("Väntande.pdf")]);
  assert.equal(notices, 1);
  assert.equal(waits, 1);
  assert.equal(h.opened.length, 1);
});

test("an unreadable, invalid or corrupt file does not stop later files", async () => {
  const h = harness({
    open: async (_, name) => {
      if (name === "Trasig.pdf") throw Error("Ogiltig PDF");
      h.opened.push(name);
    },
  });
  await h.launch([
    {
      getFile: async () => {
        throw Error("Åtkomst nekad");
      },
    },
    handle("Annat.txt"),
    handle("Trasig.pdf"),
    handle("Läsbar.pdf"),
  ]);
  await h.launch([handle("Nästa.pdf")]);
  assert.equal(h.errors.length, 3);
  assert.deepEqual(h.opened, ["Läsbar.pdf", "Nästa.pdf"]);
});
