import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentEditor } from "../src/editor/document-editor.js";
import { createTransformController } from "../src/editor/transform-controller.js";
import { createToolController } from "../src/editor/tool-controller.js";
import { createEditToolDefinitions } from "../src/editor/edit-tool-definitions.js";

const entity = (type, id, extra = {}) => ({
  type,
  id,
  page: 1,
  points: [
    { x: 100, y: 100 },
    { x: 300, y: 300 },
  ],
  color: "#147b60",
  width: 1.2,
  fontSize: 12,
  ...extra,
});
function erase(entities, selected) {
  const session = {
    state: { entities: structuredClone(entities), scales: {} },
    pageCount: 1,
    undoStack: [],
    redoStack: [],
  };
  const editor = createDocumentEditor(session);
  const definitions = createEditToolDefinitions({});
  const interaction = {
    tool: "select",
    selection: new Set(selected),
    points: [],
  };
  const noop = () => {};
  const { setTool } = createToolController({
    interaction,
    workspace: { pdf: {} },
    session,
    ...definitions,
    closeObjectMenu: noop,
    clearTracking: noop,
    presentTool: noop,
    showCategory: noop,
    refresh: noop,
    rememberStyle: noop,
    restoreStyle: noop,
    showProperties: noop,
  });
  const transform = createTransformController({
    interaction,
    session,
    ...definitions,
    clone: structuredClone,
    commit: editor.commit,
    setTool,
    refresh: noop,
    clearTracking: noop,
    toast: noop,
    error(exception) {
      throw exception;
    },
    pageEntities: () => session.state.entities,
  });
  setTool("erase");
  transform.editCommand("", 0);
  return { session, editor, interaction };
}

test("Erase removes a selected viewport and its children as one reversible edit", () => {
  const viewport = entity("viewport", "viewport", {
    denominator: 100,
    name: "Vy 1",
    showLabel: true,
  });
  const child = entity("line", "child", { viewportId: "viewport" });
  const unrelated = entity("line", "unrelated");
  const before = [viewport, child, unrelated];
  const { session, editor, interaction } = erase(before, ["viewport"]);
  assert.deepEqual(session.state.entities, [unrelated]);
  assert.equal(session.undoStack.length, 1);
  assert.equal(interaction.tool, "select");
  editor.history();
  assert.deepEqual(session.state.entities, before);
  editor.history(true);
  assert.deepEqual(session.state.entities, [unrelated]);
  assert.deepEqual(before, [viewport, child, unrelated]);
});

for (const type of ["mask", "replace"]) {
  test(`Erase accepts a selected ${type} object and preserves unrelated objects`, () => {
    const target = entity(type, "target", {
      text: type === "replace" ? "Replacement" : "",
    });
    const unrelated = entity("line", "unrelated");
    const { session, editor } = erase([target, unrelated], ["target"]);
    assert.deepEqual(session.state.entities, [unrelated]);
    editor.history();
    assert.deepEqual(session.state.entities, [target, unrelated]);
  });
}
