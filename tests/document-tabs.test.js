import test from "node:test";
import assert from "node:assert/strict";
import { matchingDocuments, reorderDocuments } from "../src/document-tabs.js";
test("search handles hundreds of documents, all query words and Swedish casing", () => {
  const docs = Array.from({ length: 350 }, (_, i) => ({
    id: String(i),
    name: `A-${String(i + 1).padStart(3, "0")} ÖVRE PLAN.pdf`,
  }));
  assert.equal(matchingDocuments(docs, "").length, 350);
  assert.deepEqual(matchingDocuments(docs, "övre 350"), [docs[349]]);
  assert.equal(matchingDocuments(docs, "  PLAN  ").length, 350);
  assert.equal(matchingDocuments(docs, "saknas").length, 0);
});

test("tabs move before or after a target in either direction without losing document state", () => {
  const docs = ["a", "b", "c", "d"].map((id) => ({
    id,
    pageNo: 3,
    state: { entities: [] },
  }));
  const ids = (items) => items.map((d) => d.id);
  assert.deepEqual(ids(reorderDocuments(docs, "a", "c", true)), [
    "b",
    "c",
    "a",
    "d",
  ]);
  assert.deepEqual(ids(reorderDocuments(docs, "d", "b")), ["a", "d", "b", "c"]);
  assert.deepEqual(ids(reorderDocuments(docs, "b", "d")), ["a", "c", "b", "d"]);
  assert.deepEqual(ids(reorderDocuments(docs, "c", "a", true)), [
    "a",
    "c",
    "b",
    "d",
  ]);
  const next = reorderDocuments(docs, "d", "a");
  assert.equal(next[0], docs[3]);
  assert.equal(next[0].state, docs[3].state);
  assert.deepEqual(ids(docs), ["a", "b", "c", "d"]);
});

test("dropping onto itself, an unchanged position or a missing document leaves order intact", () => {
  const docs = ["a", "b", "c"].map((id) => ({ id }));
  for (const [id, target, after] of [
    ["b", "b", false],
    ["b", "c", false],
    ["b", "a", true],
    ["unknown", "a", false],
    ["a", "unknown", true],
  ])
    assert.equal(reorderDocuments(docs, id, target, after), docs);
});
