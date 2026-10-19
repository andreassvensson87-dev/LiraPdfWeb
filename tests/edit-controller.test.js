import test from "node:test";
import assert from "node:assert/strict";
import { createEditController } from "../src/app/edit-controller.js";

function setup() {
  const session = {
    state: { entities: [], scales: {} },
    undoStack: [],
    redoStack: [],
  };
  const interaction = {
    activeGrip: null,
    drag: null,
    selection: new Set(),
    points: [],
  };
  const calls = [];
  const controller = createEditController({
    session,
    interaction,
    workspace: { busy: false, pageNo: 1 },
    updateChanges() {},
    refresh: () => calls.push("refresh"),
    autosave() {},
    showPage() {},
    view() {},
    closeObjectMenu() {},
    clearTracking() {},
  });
  return { controller, session, interaction, calls };
}

test("undo cancels an active drag preview before changing the committed document", () => {
  const { controller, session, interaction } = setup();
  controller.commit({ entities: [], scales: { 1: 2 } });
  interaction.drag = {
    kind: "entity",
    preview: { entities: [], scales: { 1: 5 } },
  };
  interaction.hover = { x: 5, y: 5 };
  controller.history();
  assert.equal(interaction.drag, null);
  assert.equal(interaction.hover, null);
  assert.deepEqual(session.state.scales, {});
  controller.history(true);
  assert.deepEqual(session.state.scales, { 1: 2 });
});

test("undo without history still discards and redraws a pending preview", () => {
  const { controller, interaction, calls } = setup();
  interaction.drag = { kind: "entity" };
  controller.history();
  assert.equal(interaction.drag, null);
  assert.deepEqual(calls, ["refresh"]);
});
