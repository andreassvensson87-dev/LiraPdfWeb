import test from "node:test";
import assert from "node:assert/strict";
import { detailRegion, createDetailRenderer } from "../src/pdf-detail.js";
const view = {
  width: 2384,
  height: 3370,
  zoom: 4,
  pan: { x: -3000, y: -4000 },
  screenWidth: 1200,
  screenHeight: 800,
  dpr: 2,
};
test("visible region uses zoom and retina density without allocating the whole sheet", () => {
  const r = detailRegion(view);
  assert.equal(r.scale, 8);
  assert.equal(r.x, 725);
  assert.equal(r.y, 975);
  assert.equal(r.width, 350);
  assert.equal(r.pixelsWide, 2800);
  assert.ok(r.width < view.width);
});
test("region clamps page edges, handles off-page pan, fit and large displays", () => {
  const r = detailRegion({
    ...view,
    pan: { x: 100, y: 100 },
    zoom: 0.2,
    dpr: 2,
  });
  assert.equal(r.x, 0);
  assert.equal(r.y, 0);
  assert.equal(r.width, 2384);
  assert.equal(r.scale, 0.4);
  assert.equal(detailRegion({ ...view, pan: { x: 2000, y: 2000 } }), null);
  const huge = detailRegion({
    ...view,
    screenWidth: 16000,
    screenHeight: 16000,
    dpr: 4,
    pan: { x: 0, y: 0 },
  });
  assert.ok(huge.pixelsWide * huge.pixelsHigh <= 12000000);
  assert.ok(Math.max(huge.pixelsWide, huge.pixelsHigh) <= 8192);
});
test("clearing a page cancels queued detail work and disposes its edited PDF once", async () => {
  let renders = 0,
    disposed = 0;
  const renderer = createDetailRenderer({});
  renderer.setPage(
    {
      render() {
        renders++;
      },
    },
    () => {
      disposed++;
    },
  );
  renderer.update(view);
  await renderer.clear();
  await renderer.clear();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(renders, 0);
  assert.equal(disposed, 1);
});

test("late render from an old view cannot replace the current image", async () => {
  const originalDocument = globalThis.document;
  const buffers = [],
    pending = [],
    inserted = [];
  globalThis.document = {
    createElement() {
      const canvas = {
        style: {},
        setAttribute() {},
        getContext() {
          return {};
        },
        remove() {},
      };
      buffers.push(canvas);
      return canvas;
    },
  };
  const renderer = createDetailRenderer({
    querySelector() {
      return {};
    },
    insertBefore(c) {
      inserted.push(c);
    },
  });
  renderer.setPage({
    getViewport({ scale }) {
      return { scale };
    },
    render() {
      let resolve;
      const promise = new Promise((r) => (resolve = r));
      const task = { promise, cancel() {}, resolve };
      pending.push(task);
      return task;
    },
  });
  try {
    renderer.update(view);
    await new Promise((r) => setTimeout(r, 115));
    renderer.update({ ...view, zoom: 5 });
    await new Promise((r) => setTimeout(r, 115));
    pending[1].resolve();
    await Promise.resolve();
    pending[0].resolve();
    await Promise.resolve();
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0], buffers[1]);
    await renderer.clear();
  } finally {
    globalThis.document = originalDocument;
  }
});
