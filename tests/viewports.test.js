import test from "node:test";
import assert from "node:assert/strict";
import {
  viewportAt,
  entityScale,
  changeViewportScale,
  transformChildren,
  mmPerPoint,
} from "../src/viewports.js";
import { distance, primitives, validateProject } from "../src/core.js";
const frame = {
  id: "v",
  type: "viewport",
  page: 1,
  points: [
    { x: 20, y: 30 },
    { x: 250, y: 230 },
  ],
  denominator: 100,
  color: "#147b60",
  width: 1,
  fontSize: 12,
};
const line = {
  ...frame,
  id: "line",
  type: "line",
  viewportId: "v",
  points: [
    { x: 30, y: 40 },
    { x: 30 + 5000 / (100 * mmPerPoint), y: 40 },
  ],
};
const circle = {
  ...line,
  id: "circle",
  type: "circle",
  points: [
    { x: 60, y: 60 },
    { x: 60 + 1000 / (100 * mmPerPoint), y: 60 },
  ],
};
const paper = {
  ...line,
  id: "paper",
  viewportId: undefined,
  points: [
    { x: 300, y: 40 },
    { x: 400, y: 40 },
  ],
};
const state = { entities: [frame, line, circle, paper], scales: { 1: 5 } };
test("5000 mm in viewport remains 5000 mm after changing 1:100 to 1:50 and back", () => {
  const next = changeViewportScale(state, "v", 50);
  assert.ok(
    Math.abs(
      distance(...next.entities[1].points) - distance(...line.points) * 2,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      distance(...next.entities[1].points) *
        entityScale(next.entities[1], next.entities, next.scales) -
        5000,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      distance(...next.entities[2].points) *
        entityScale(next.entities[2], next.entities, next.scales) -
        1000,
    ) < 1e-9,
  );
  assert.deepEqual(next.entities[3], paper);
  assert.deepEqual(next.scales, state.scales);
  assert.ok(
    Math.abs(
      changeViewportScale(next, "v", 100).entities[1].points[1].x -
        line.points[1].x,
    ) < 1e-9,
  );
});
test("outside uses paper scale, overlapping frames use smallest, page isolation", () => {
  assert.equal(viewportAt(state.entities, 1, { x: 350, y: 40 }), null);
  assert.equal(entityScale(paper, state.entities, state.scales), 5);
  assert.equal(viewportAt(state.entities, 2, { x: 40, y: 40 }), null);
  const small = {
    ...frame,
    id: "small",
    points: [
      { x: 30, y: 40 },
      { x: 80, y: 90 },
    ],
  };
  assert.equal(
    viewportAt([...state.entities, small], 1, { x: 40, y: 50 }).id,
    "small",
  );
});
test("dimension values stay invariant and ownership survives moving outside frame and project roundtrip", () => {
  const dim = {
    ...line,
    id: "dim",
    type: "dim",
    points: [...line.points, { x: 90, y: 70 }],
  };
  const s = { ...state, entities: [...state.entities, dim] };
  const value = (x) =>
    primitives(
      x.entities.at(-1),
      entityScale(x.entities.at(-1), x.entities, x.scales),
    ).find((p) => p.kind === "text").value;
  assert.equal(value(s), value(changeViewportScale(s, "v", 20)));
  const moved = structuredClone(s);
  transformChildren(moved, "v", { x: 0, y: 0 }, 1, { x: 1000, y: 1000 });
  assert.equal(value(s), value(moved));
  assert.equal(
    entityScale(moved.entities[1], moved.entities, moved.scales),
    100 * mmPerPoint,
  );
  const project = {
    format: "lirapdf",
    version: 1,
    pdf: "AA==",
    ...JSON.parse(JSON.stringify(moved)),
  };
  assert.deepEqual(validateProject(project), project);
  assert.throws(
    () =>
      validateProject({
        ...project,
        entities: project.entities.filter((e) => e.id !== "v"),
      }),
    /viewport saknas/,
  );
  assert.throws(() => changeViewportScale(s, "v", 0), /skala/);
});

test("PDF export uses viewport scale for dimensions and omits frame", async () => {
  const { PDFDocument, PDFRawStream, decodePDFRawStream } =
    await import("pdf-lib");
  const { exportPdf } = await import("../src/export.js");
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const source = {
    getPage: async () => ({
      rotate: 0,
      getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 800 - y] }),
    }),
  };
  const dim = {
    ...line,
    id: "dim",
    type: "dim",
    points: [...line.points, { x: 90, y: 70 }],
  };
  const state2 = changeViewportScale(
    { ...state, entities: [frame, dim] },
    "v",
    50,
  );
  const data = await exportPdf(
    await doc.save(),
    state2.entities,
    state2.scales,
    source,
  );
  const result = await PDFDocument.load(data);
  const content = result
    .getPage(0)
    .node.Contents()
    .asArray()
    .map((ref) =>
      Buffer.from(
        decodePDFRawStream(result.context.lookup(ref, PDFRawStream)).decode(),
      ).toString("latin1"),
    )
    .join("");
  assert.match(content, /35A0303030206D6D/);
  // Dimension produces seven strokes; the four-sided editor frame adds none.
  assert.equal(content.split("\n").filter((s) => s === "S").length, 7);
});
