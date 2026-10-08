import test from "node:test";
import assert from "node:assert/strict";
import { choosePdfTarget, writePdfFile } from "../src/pdf-file-save.js";

test("Ctrl+S reuses the opened handle and requests write access before writing", async () => {
  const calls = [];
  const handle = {
    queryPermission: async (options) => {
      calls.push(options.mode);
      return "prompt";
    },
    requestPermission: async () => {
      calls.push("permission");
      return "granted";
    },
    createWritable: async () => ({
      write: async (bytes) => calls.push([...bytes]),
      close: async () => calls.push("closed"),
    }),
  };
  assert.equal(
    await choosePdfTarget(handle, "Test.pdf", false, () => {
      throw Error("Must not open a picker");
    }),
    handle,
  );
  await writePdfFile(handle, Uint8Array.of(1, 2));
  assert.deepEqual(calls, ["readwrite", "permission", [1, 2], "closed"]);
});

test("new documents and Save As choose a PDF destination; cancellation and permission denial leave files untouched", async () => {
  let selected;
  const handle = {};
  const picker = async (options) => {
    selected = options;
    return handle;
  };
  assert.equal(
    await choosePdfTarget(null, "Old.lirapdf", false, picker),
    handle,
  );
  assert.equal(selected.suggestedName, "Old.pdf");
  assert.equal(await choosePdfTarget({}, "Old.pdf", true, picker), handle);
  await assert.rejects(
    choosePdfTarget(null, "Test.pdf", false, async () => {
      throw new DOMException("Cancelled", "AbortError");
    }),
    { name: "AbortError" },
  );
  await assert.rejects(
    choosePdfTarget(
      {
        queryPermission: async () => "denied",
        requestPermission: async () => "denied",
      },
      "Test.pdf",
    ),
    /skrivrättighet/,
  );
});

test("failed writes abort and do not report success", async () => {
  let aborted = false,
    closed = false;
  await assert.rejects(
    writePdfFile(
      {
        createWritable: async () => ({
          write: async () => {
            throw Error("Disk full");
          },
          abort: async () => {
            aborted = true;
          },
          close: async () => {
            closed = true;
          },
        }),
      },
      Uint8Array.of(1),
    ),
    /Disk full/,
  );
  assert.equal(aborted, true);
  assert.equal(closed, false);
});
