import test from "node:test";
import assert from "node:assert/strict";
import { pageLayout, scrollPosition } from "../src/document-scroll.js";

const sizes = [
  { width: 400, height: 600 },
  { width: 800, height: 500 },
  { width: 400, height: 600 },
];

test("continuous scrolling preserves screen positions when the active page changes", () => {
  const layout = pageLayout(sizes);
  const pan = { x: 100, y: 28 };
  const next = scrollPosition(layout, 1, pan, 1, 0, 650, 700);
  assert.equal(next.page, 2);
  assert.equal(next.pan.y, 2);
  assert.equal(next.pan.x, -100);
  assert.equal(next.pan.y - layout[1].top, next.currentPan.y);
  const previous = scrollPosition(layout, 2, next.pan, 1, 0, -650, 700);
  assert.equal(previous.page, 1);
  assert.deepEqual(previous.pan, pan);
});

test("document ends clamp while wide pages still scroll horizontally", () => {
  const layout = pageLayout(sizes);
  const first = scrollPosition(
    layout,
    1,
    { x: 100, y: 28 },
    1,
    80,
    -10000,
    700,
  );
  assert.deepEqual(first.pan, { x: 20, y: 28 });
  const last = scrollPosition(layout, 1, { x: 100, y: 28 }, 1, 0, 10000, 700);
  assert.equal(last.page, 3);
  assert.equal(last.pan.y + layout[2].height, 672);
});

test("mixed page rotations and zoom keep page offsets consistent", () => {
  const layout = pageLayout(sizes, { 2: 90 });
  assert.equal(layout[1].width, 500);
  assert.equal(layout[1].height, 800);
  assert.equal(layout[2].top, 1448);
  const next = scrollPosition(layout, 1, { x: 100, y: 28 }, 2, 0, 1300, 700);
  assert.equal(next.page, 2);
  assert.equal(next.pan.y - layout[1].top * 2, next.currentPan.y);
  assert.equal(next.pan.x, 0);
});

test("short documents retain their centered fit position", () => {
  const layout = pageLayout([{ width: 200, height: 300 }]);
  const next = scrollPosition(layout, 1, { x: 100, y: 200 }, 1, 0, 0, 700);
  assert.deepEqual(next.pan, { x: 100, y: 200 });
});
