import test from "node:test";
import assert from "node:assert/strict";
import { pageLayout, scrollPosition } from "../src/document-scroll.js";
import { documentScrollMetrics, scrollbarGeometry } from "../src/scrollbars.js";

const layout = pageLayout([
  { width: 400, height: 600 },
  { width: 800, height: 500 },
  { width: 400, height: 600 },
]);

test("vertical scrollbar reaches the first and last document edges", () => {
  const first = documentScrollMetrics(
    layout,
    1,
    { x: 100, y: 28 },
    1,
    600,
    700,
  );
  assert.equal(first.y.value, 0);
  const end = scrollPosition(
    layout,
    1,
    { x: 100, y: 28 },
    1,
    0,
    first.y.range,
    700,
  );
  assert.equal(end.page, 3);
  const last = documentScrollMetrics(layout, end.page, end.pan, 1, 600, 700);
  assert.equal(last.y.value, 1);
  assert.equal(last.y.offset, last.y.range);
});

test("both scrollbar positions are continuous when changing active pages of different widths", () => {
  const next = scrollPosition(layout, 1, { x: 100, y: 28 }, 1.5, 80, 900, 700);
  assert.equal(next.page, 2);
  const before = documentScrollMetrics(
    layout,
    1,
    next.currentPan,
    1.5,
    600,
    700,
  );
  const after = documentScrollMetrics(
    layout,
    next.page,
    next.pan,
    1.5,
    600,
    700,
  );
  assert.deepEqual(after, before);
});

test("short fitted pages disable scrolling; zoom, rotation and resize change the available range", () => {
  const sizes = [{ width: 400, height: 600 }];
  const fitted = documentScrollMetrics(
    pageLayout(sizes),
    1,
    { x: 100, y: 100 },
    1,
    600,
    800,
  );
  assert.equal(fitted.x.range, 0);
  assert.equal(fitted.y.range, 0);
  const zoomed = documentScrollMetrics(
    pageLayout(sizes),
    1,
    { x: 28, y: 28 },
    2,
    600,
    800,
  );
  assert.equal(zoomed.x.range, 256);
  assert.equal(zoomed.y.range, 456);
  const rotated = documentScrollMetrics(
    pageLayout(sizes, { 1: 90 }),
    1,
    { x: 28, y: 28 },
    1,
    600,
    800,
  );
  assert.equal(rotated.x.range, 56);
  assert.equal(rotated.y.range, 0);
  const resized = documentScrollMetrics(
    pageLayout(sizes),
    1,
    { x: 28, y: 28 },
    1,
    300,
    400,
  );
  assert.equal(resized.x.range, 156);
  assert.equal(resized.y.range, 256);
});

test("very long documents keep a usable thumb with exact endpoint travel", () => {
  const metric = { viewport: 700, content: 1000000, value: 1 };
  assert.deepEqual(scrollbarGeometry(700, metric), {
    thumb: 24,
    travel: 676,
    position: 676,
  });
  assert.deepEqual(
    scrollbarGeometry(700, { viewport: 700, content: 700, value: 0 }),
    { thumb: 700, travel: 0, position: 0 },
  );
  assert.equal(documentScrollMetrics([], 1, { x: 0, y: 0 }, 1, 600, 700), null);
});
