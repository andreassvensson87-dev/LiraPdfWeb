import test from "node:test";
import assert from "node:assert/strict";
import { matchingDocuments } from "../src/document-tabs.js";
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
