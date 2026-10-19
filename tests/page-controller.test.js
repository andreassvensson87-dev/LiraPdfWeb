import test from "node:test";
import assert from "node:assert/strict";
import { createPageController } from "../src/app/page-controller.js";
import { createWorkspaceState } from "../src/app/workspace-state.js";

const result = (page) => ({
  viewport: { page },
  segments: [],
  textItems: [],
  removableTextTargets: [],
});
function setup() {
  const state = createWorkspaceState(),
    requests = [],
    presented = [],
    errors = [];
  state.workspace.pdf = { numPages: 3 };
  const renderer = {
    cancel: async () => {},
    render: (options) =>
      new Promise((resolve, reject) =>
        requests.push({ ...options, resolve, reject }),
      ),
  };
  const controller = createPageController({
    ...state,
    renderer,
    closeObjectMenu() {},
    clearTracking() {},
    prepareMarkupPreviews: async () => {},
    presentPage: (page) => presented.push(page),
    refresh() {},
    view() {},
    fit() {},
    refreshLibrary() {},
    autosave() {},
    error: (error) => errors.push(error),
  });
  return { ...state, controller, requests, presented, errors };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a stale page render cannot overwrite the newer page or unlock its loading state", async () => {
  const { controller, workspace, requests, presented } = setup();
  const first = controller.showPage(1);
  await tick();
  const second = controller.showPage(2);
  await tick();
  requests[0].resolve(result(1));
  assert.equal(await first, false);
  assert.equal(workspace.busy, true);
  assert.deepEqual(presented, []);
  requests[1].resolve(result(2));
  assert.equal(await second, true);
  assert.equal(workspace.viewport.page, 2);
  assert.equal(workspace.busy, false);
  assert.deepEqual(presented, [2]);
});

test("render failure releases loading state and invalid page requests do not start a job", async () => {
  const { controller, workspace, requests, errors } = setup();
  assert.equal(await controller.showPage(4), false);
  assert.equal(requests.length, 0);
  const pending = controller.showPage(1);
  await tick();
  requests[0].reject(Error("Raster failed"));
  assert.equal(await pending, false);
  assert.equal(workspace.busy, false);
  assert.equal(errors[0].message, "Raster failed");
});
