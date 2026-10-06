import test from "node:test";
import assert from "node:assert/strict";
import {
  expandGroups,
  groupObjects,
  ungroupObjects,
  normalizeGroups,
  copyGroupIds,
} from "../src/groups.js";
import { translateEntity } from "../src/editing.js";
import { validateProject } from "../src/core.js";

const entity = (id, page = 1) => ({
  id,
  page,
  type: "line",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  color: "#147b60",
  width: 1,
  fontSize: 12,
});
const project = (entities) => ({
  format: "lirapdf",
  version: 1,
  pdf: "",
  scales: {},
  entities,
});

test("groups retain individual objects and survive project serialization", () => {
  const originals = [entity("a"), entity("b"), entity("c")];
  const grouped = groupObjects(originals, ["a", "b"], "g");
  const saved = JSON.parse(JSON.stringify(project(grouped)));
  validateProject(saved);
  assert.deepEqual(expandGroups(saved.entities, ["a"]), ["a", "b"]);
  assert.deepEqual(expandGroups(saved.entities, ["a", "c"]), ["a", "b", "c"]);
  assert.equal(originals[0].groupId, undefined);
  assert.deepEqual(grouped[0].points, originals[0].points);
});
test("moving a group preserves relative positions and individual editing preserves membership", () => {
  const grouped = groupObjects([entity("a"), entity("b")], ["a", "b"], "g");
  const ids = expandGroups(grouped, ["a"]);
  const moved = grouped.map((e) =>
    ids.includes(e.id)
      ? translateEntity(e, { x: 0, y: 0 }, { x: 20, y: 30 })
      : e,
  );
  assert.deepEqual(
    moved.map((e) => e.points[0]),
    [
      { x: 20, y: 30 },
      { x: 20, y: 30 },
    ],
  );
  const edited = moved.map((e) =>
    e.id === "a" ? { ...e, color: "#ff0000", opacity: 0.5 } : e,
  );
  assert.equal(edited[1].color, "#147b60");
  assert.deepEqual(expandGroups(edited, ["a"]), ["a", "b"]);
});
test("regrouping absorbs whole groups; ungrouping any member dissolves its entire group", () => {
  const grouped = groupObjects(
    [entity("a"), entity("b"), entity("c"), entity("d")],
    ["a", "b"],
    "g1",
  );
  const regrouped = groupObjects(grouped, ["a", "c"], "g2");
  assert.deepEqual(expandGroups(regrouped, ["c"]), ["a", "b", "c"]);
  const ungrouped = ungroupObjects(regrouped, ["a"]);
  assert.ok(ungrouped.every((e) => e.groupId === undefined));
  assert.equal(regrouped[0].groupId, "g2");
});
test("group copies are independent from originals and keep members together", () => {
  const grouped = groupObjects(
    [entity("a"), entity("b"), entity("c")],
    ["a", "b"],
    "g",
  );
  let sequence = 0;
  const copied = copyGroupIds(grouped, () => `new-${++sequence}`);
  assert.equal(copied[0].groupId, copied[1].groupId);
  assert.notEqual(copied[0].groupId, "g");
  assert.equal(copied[2].groupId, undefined);
  assert.deepEqual(expandGroups([...grouped, ...copied], [copied[0].id]), [
    copied[0].id,
    copied[1].id,
  ]);
  validateProject(project([...grouped, ...copied]));
});
test("deleting an individual member removes an orphan group; undo snapshot stays intact", () => {
  const grouped = groupObjects([entity("a"), entity("b")], ["a", "b"], "g");
  const next = structuredClone(grouped).filter((e) => e.id !== "a");
  normalizeGroups(next);
  assert.equal(next[0].groupId, undefined);
  assert.equal(grouped[1].groupId, "g");
});
test("invalid memberships and groups across pages fail validation", () => {
  for (const groupId of [null, 2, "", "g".repeat(101)])
    assert.throws(() =>
      validateProject(project([{ ...entity("a"), groupId }])),
    );
  assert.throws(() =>
    validateProject(
      project([
        { ...entity("a"), groupId: "g" },
        { ...entity("b", 2), groupId: "g" },
      ]),
    ),
  );
  assert.throws(() =>
    groupObjects([entity("a"), entity("b", 2)], ["a", "b"], "g"),
  );
  assert.throws(() => groupObjects([entity("a")], ["a"], "g"));
  assert.deepEqual(
    expandGroups(
      [
        { ...entity("a"), groupId: "g" },
        { ...entity("b", 2), groupId: "g" },
      ],
      ["a"],
    ),
    ["a"],
  );
});
