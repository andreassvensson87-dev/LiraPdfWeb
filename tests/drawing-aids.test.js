import test from "node:test";
import assert from "node:assert/strict";
import {
  polarPoint,
  trackingPoint,
  createTracker,
  snapSymbol,
} from "../src/drawing-aids.js";
import { constrain, distance } from "../src/core.js";
test("polar catches increments in all quadrants without locking unrelated angles", () => {
  for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const rad = ((angle + 2) * Math.PI) / 180,
      origin = { x: 10, y: 20 };
    const hit = polarPoint(
      origin,
      { x: 10 + 100 * Math.cos(rad), y: 20 + 100 * Math.sin(rad) },
      45,
    );
    assert.ok(hit);
    const target = (angle * Math.PI) / 180;
    assert.ok(
      Math.abs(
        (hit.point.y - origin.y) * Math.cos(target) -
          (hit.point.x - origin.x) * Math.sin(target),
      ) < 1e-8,
    );
    const final = constrain(origin, hit.point, false, 5000, (100 * 25.4) / 72);
    assert.ok(
      Math.abs((distance(origin, final) * 100 * 25.4) / 72 - 5000) < 1e-8,
    );
  }
  assert.equal(polarPoint({ x: 0, y: 0 }, { x: 100, y: 30 }, 45), null);
  assert.equal(polarPoint({ x: 1, y: 1 }, { x: 1, y: 1 }), null);
});
test("OTRACK acquires by dwell, retains two points and clears on reset", () => {
  const tracker = createTracker();
  const hit = { point: { x: 10, y: 20 }, kind: "Ändpunkt" };
  assert.equal(tracker.update(hit, 0).length, 0);
  assert.equal(tracker.update(hit, 200).length, 0);
  assert.deepEqual(tracker.update(null, 500), [hit.point]);
  for (const [time, x] of [
    [600, 30],
    [1200, 50],
  ]) {
    tracker.update({ point: { x, y: 20 }, kind: "Mittpunkt" }, time);
    tracker.update(null, time + 500);
  }
  assert.deepEqual(tracker.update(null, 2000), [
    { x: 30, y: 20 },
    { x: 50, y: 20 },
  ]);
  tracker.clear();
  assert.deepEqual(tracker.update(null, 3000), []);
  tracker.update({ point: { x: 5, y: 5 }, kind: "Linje" }, 4000);
  assert.deepEqual(tracker.update(null, 5000), []);
});
test("OTRACK intersects horizontal and vertical guides and releases outside tolerance", () => {
  const anchors = [
    { x: 30, y: 80 },
    { x: 100, y: 200 },
  ];
  const hit = trackingPoint({ x: 33, y: 196 }, anchors, 8);
  assert.deepEqual(hit.point, { x: 30, y: 200 });
  assert.equal(hit.guides.length, 2);
  assert.equal(trackingPoint({ x: 60, y: 120 }, anchors, 8), null);
  assert.equal(trackingPoint({ x: 33, y: 196 }, anchors, 2), null);
});
test("polar and tracking intersect exactly in every quadrant", () => {
  const origin = { x: 150, y: 250 };
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const axis of ["x", "y"]) {
        const target = { x: origin.x + sx * 100, y: origin.y + sy * 100 };
        const pointer = { x: target.x + 3, y: target.y + 1 };
        const anchor =
          axis === "x"
            ? { x: target.x, y: origin.y - 40 }
            : { x: origin.x + 40, y: target.y };
        const polar = polarPoint(origin, pointer);
        const hit = trackingPoint(pointer, [anchor], 8, polar);
        assert.ok(hit);
        assert.ok(distance(hit.point, target) < 1e-8);
        assert.deepEqual(hit.guides[0].a, anchor);
        assert.deepEqual(hit.guides[0].b, hit.point);
      }
});
test("combined tracking chooses nearby intersections and rejects parallel, distant and backwards rays", () => {
  const polar = { origin: { x: 0, y: 0 }, angle: Math.PI / 4 };
  assert.equal(
    trackingPoint({ x: 100, y: 100 }, [{ x: 130, y: 150 }], 8, polar),
    null,
  );
  assert.equal(
    trackingPoint({ x: -100, y: -100 }, [{ x: -100, y: -200 }], 8, polar),
    null,
  );
  for (const angle of [0, Math.PI / 2])
    assert.equal(
      trackingPoint({ x: 100, y: 100 }, [{ x: 100, y: 100 }], 8, {
        origin: polar.origin,
        angle,
      }),
      null,
    );
  const hit = trackingPoint(
    { x: 102, y: 100 },
    [
      { x: 105, y: 180 },
      { x: 100, y: 180 },
    ],
    8,
    polar,
  );
  assert.ok(distance(hit.point, { x: 100, y: 100 }) < 1e-8);
  assert.equal(
    trackingPoint({ x: 102, y: 100 }, [{ x: 100, y: 180 }], 1, polar),
    null,
  );
});
test("snap symbols distinguish endpoint, midpoint, edge and other object points", () => {
  assert.equal(
    new Set(
      ["Ändpunkt", "Mittpunkt", "Linje", "Objekt"].map((k) =>
        snapSymbol(k, 10, 20, 4),
      ),
    ).size,
    4,
  );
});
