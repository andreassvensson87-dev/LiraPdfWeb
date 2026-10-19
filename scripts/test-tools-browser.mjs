import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { PDFDocument, PDFDict, PDFName, PDFNumber, rgb } from "pdf-lib";
import { pageContent, removableLines } from "../src/pdf-line-edit.js";
import { removableTexts } from "../src/pdf-text-edit.js";

// End-to-end tool checks use real controls and persisted state, with an isolated
// browser context per case. They never read or change a developer's browser data.
const url = process.env.LIRAPDF_URL || "http://127.0.0.1:5178/";
const filter = new RegExp(process.env.TOOL_FILTER || ".");
const artifacts =
  process.env.TOOL_ARTIFACTS || path.join(os.tmpdir(), "lirapdf-tools");
await fs.mkdir(artifacts, { recursive: true });
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
} catch (error) {
  throw Error(`Starta appen med pnpm dev före pnpm test:tools (${url}).`, {
    cause: error,
  });
}
const pdf = await PDFDocument.create();
const sheet = pdf.addPage([600, 600]);
sheet.drawText("SOURCE_TEXT", { x: 60, y: 540, size: 14 });
sheet.drawLine({
  start: { x: 60, y: 480 },
  end: { x: 260, y: 480 },
  thickness: 2,
  color: rgb(0, 0, 0),
});
sheet.drawLine({
  start: { x: 400, y: 480 },
  end: { x: 400, y: 300 },
  thickness: 2,
});
const bytes = Buffer.from(await pdf.save());
const stampPdf = await PDFDocument.create();
const stampPage = stampPdf.addPage([180, 80]);
const stampField = stampPdf.getForm().createTextField("Granskare");
stampField.setText("Original");
stampField.addToPage(stampPage, { x: 10, y: 20, width: 150, height: 25 });
const stampBytes = Buffer.from(await stampPdf.save());
const style = { color: "#147b60", width: 1.2, fontSize: 12, opacity: 1 };
const pt = (x, y) => ({ x, y });
const entity = (type, id, points, extra = {}) => ({
  type,
  id,
  points: points.map(([x, y]) => pt(x, y)),
  page: 1,
  ...style,
  ...extra,
});
const line = (
  id = "line",
  points = [
    [150, 250],
    [250, 250],
  ],
  extra = {},
) => entity("line", id, points, extra);
const rect = () =>
  entity("rect", "rect", [
    [150, 200],
    [350, 350],
  ]);
const viewport = () =>
  entity(
    "viewport",
    "vp",
    [
      [100, 180],
      [400, 420],
    ],
    { denominator: 100, name: "Vy 1", showLabel: true },
  );
const browser = await chromium.launch({ headless: true });
const results = [];
let sequence = 0;

async function scenario(name, entities, run, { scales = { 1: 1 } } = {}) {
  if (!filter.test(name)) return;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    window.showSaveFilePicker = undefined;
    window.showOpenFilePicker = undefined;
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const namePdf = `Toolcheck-${++sequence}.pdf`;
  const initial = { entities: structuredClone(entities), scales };
  async function state() {
    return page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lirapdf", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise((resolve, reject) => {
          const request = db
            .transaction("projects")
            .objectStore("projects")
            .get("current");
          request.onsuccess = () => {
            const data = request.result;
            resolve(data?.documents.find((d) => d.id === data.activeId)?.state);
          };
          request.onerror = () => reject(request.error);
        });
      } finally {
        db.close();
      }
    });
  }
  async function expectState(predicate, message = "expected document change") {
    let latest;
    for (let i = 0; i < 60; i++) {
      latest = await state();
      if (predicate(latest)) return latest;
      await delay(50);
    }
    throw Error(
      `${message}; state=${JSON.stringify(latest)}; toast=${await page.locator("#toast").textContent()}; errors=${errors.join("; ")}`,
    );
  }
  async function screen(x, y) {
    return page.locator("#overlay").evaluate(
      (svg, [x, y]) => {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        const screen = point.matrixTransform(svg.getScreenCTM());
        return { x: screen.x, y: screen.y };
      },
      [x, y],
    );
  }
  async function click(x, y, options = {}) {
    const p = await screen(x, y);
    await page.mouse.click(p.x, p.y, options);
  }
  async function drag(a, b, options = {}) {
    const from = await screen(...a),
      to = await screen(...b);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down(options);
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up(options);
  }
  async function cmd(value) {
    await page.locator("#command").fill(value);
    await page.locator("#command").press("Enter");
  }
  async function activate(tool) {
    const category = [
      "move",
      "copy",
      "offset",
      "rotate",
      "scale",
      "mirror",
      "trim",
      "extend",
      "erase",
      "join",
      "explode",
      "fillet",
      "chamfer",
      "pinsert",
      "pdelete",
    ].includes(tool)
      ? "edit"
      : ["viewport", "dim", "calibrate"].includes(tool)
        ? "measure"
        : [
              "mask",
              "extract",
              "coverLine",
              "eraseLine",
              "eraseText",
              "replace",
            ].includes(tool)
          ? "pdf"
          : "create";
    await page.locator(`[data-category=${category}]`).click();
    if (tool === "calibrate") await page.locator("#measureCalibrate").click();
    else if (tool === "replace") await page.locator("#replace").click();
    else if (tool === "ellipse") {
      await page.locator("[data-tool=circle]").click();
      await page.locator("#circleShape").selectOption("ellipse");
    } else await page.locator(`[data-tool=${tool}]`).click();
  }
  async function answer(value) {
    await page.locator("#dialog[open]").waitFor();
    const input = (await page.locator("#numberInput").isVisible())
      ? page.locator("#numberInput")
      : page.locator("#textInput");
    await input.fill(String(value));
    await page.locator('#dialog button[value="ok"]').click();
    await page.locator("#dialog").waitFor({ state: "hidden" });
  }
  async function text(value) {
    const input = page.locator(".canvas-text-editor");
    await input.fill(value);
    await input.press("Control+Enter");
    await input.waitFor({ state: "detached" });
  }
  async function undoRedo(before = initial) {
    const after = await state();
    await page.locator("#undo").click();
    await expectState(
      (s) =>
        JSON.stringify(s.entities) === JSON.stringify(before.entities) &&
        JSON.stringify(s.scales) === JSON.stringify(before.scales),
      "undo must restore previous content",
    );
    await page.locator("#redo").click();
    await expectState(
      (s) => JSON.stringify(s) === JSON.stringify(after),
      "redo must restore result",
    );
  }
  async function select(x = 200, y = 250) {
    await page.keyboard.press("Escape");
    await click(x, y);
  }
  try {
    await page.goto(url);
    await page.waitForFunction(
      () =>
        document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
    );
    await page.locator("#projectInput").setInputFiles({
      name: "tools.lirapdf",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "lirapdf",
          version: 1,
          pdf: bytes.toString("base64"),
          name: namePdf,
          ...initial,
        }),
      ),
    });
    await page.waitForFunction(
      (name) =>
        document.querySelector("#filename").textContent === name &&
        document.querySelector("#saveStatus").textContent ===
          "Sparat i webbläsaren",
      namePdf,
    );
    for (const id of ["snap", "polar", "otrack"])
      if (
        ((await page.locator(`#${id}`).getAttribute("class")) || "").includes(
          "active",
        )
      )
        await page.locator(`#${id}`).click();
    await run({
      page,
      state,
      expectState,
      screen,
      click,
      drag,
      cmd,
      activate,
      answer,
      text,
      undoRedo,
      select,
      errors,
      initial,
    });
    assert.deepEqual(errors, [], "No runtime or console errors");
    assert.equal(
      await page
        .locator("header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(255, 255, 255)",
    );
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (exception) {
    results.push({ name, ok: false, error: exception.stack });
    console.error(`FAIL ${name}: ${exception.message}`);
    await page
      .screenshot({
        path: path.join(artifacts, `${sequence}-failure.png`),
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    await context.close();
  }
}

for (const [tool, points] of [
  [
    "line",
    [
      [150, 200],
      [300, 200],
    ],
  ],
  [
    "rect",
    [
      [150, 200],
      [300, 320],
    ],
  ],
  [
    "circle",
    [
      [220, 250],
      [280, 250],
    ],
  ],
  [
    "ellipse",
    [
      [150, 200],
      [310, 300],
    ],
  ],
  [
    "arc",
    [
      [150, 300],
      [220, 200],
      [300, 300],
    ],
  ],
  [
    "cloud",
    [
      [150, 200],
      [300, 300],
    ],
  ],
  [
    "stamp",
    [
      [150, 200],
      [330, 300],
    ],
  ],
  ["text", [[170, 240]]],
  [
    "leader",
    [
      [150, 300],
      [220, 240],
      [300, 240],
    ],
  ],
  [
    "dim",
    [
      [150, 250],
      [300, 250],
      [220, 300],
    ],
  ],
])
  await scenario(`create/${tool}`, [], async (t) => {
    await t.activate(tool);
    for (const point of points) await t.click(...point);
    if (["text", "leader"].includes(tool)) await t.text(`Kontroll ${tool}`);
    const s = await t.expectState((s) => s?.entities.length === 1);
    assert.equal(s.entities[0].type, tool);
    if (tool === "stamp") assert.equal(s.entities[0].text, "PRELIMINÄR");
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
for (const tool of ["freehand", "highlight"])
  await scenario(`create/${tool}`, [], async (t) => {
    await t.activate(tool);
    await t.drag([150, 230], [310, 280]);
    const s = await t.expectState((s) => s?.entities.length === 1);
    assert.equal(s.entities[0].type, tool);
    assert.ok(s.entities[0].points.length >= 2);
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
await scenario("create/custom-stamp", [], async (t) => {
  await t.activate("stamp");
  await t.page.locator("#stampPreset").selectOption("custom");
  await t.click(150, 200);
  await t.click(340, 300);
  await t.text("GRANSKAD ÅÄÖ");
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.equal(s.entities[0].text, "GRANSKAD ÅÄÖ");
  await t.undoRedo();
});
await scenario(
  "measure/calibrate",
  [],
  async (t) => {
    await t.activate("calibrate");
    await t.click(100, 200);
    await t.click(300, 200);
    await t.answer(1000);
    await t.expectState((s) => Math.abs(s?.scales[1] - 5) < 0.000001);
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  },
  { scales: {} },
);
await scenario("measure/viewport", [], async (t) => {
  await t.activate("viewport");
  await t.click(100, 180);
  await t.click(400, 420);
  await t.answer(50);
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.equal(s.entities[0].denominator, 50);
  await t.undoRedo();
});
await scenario(
  "measure/viewport-properties-and-children",
  [
    viewport(),
    line(
      "child",
      [
        [150, 250],
        [250, 250],
      ],
      { viewportId: "vp" },
    ),
  ],
  async (t) => {
    await t.select(100, 300);
    await t.page.locator("#viewportName").fill("Detalj A");
    await t.page.locator("#viewportName").press("Tab");
    await t.expectState((s) => s?.entities[0].name === "Detalj A");
    const before = await t.state();
    await t.page.locator("#viewportScale").fill("50");
    await t.page.locator("#viewportScale").press("Tab");
    const s = await t.expectState((s) => s?.entities[0].denominator === 50);
    assert.notDeepEqual(s.entities[1].points, before.entities[1].points);
    await t.undoRedo(before);
  },
);
for (const tool of ["move", "copy", "rotate", "scale", "mirror", "offset"])
  await scenario(`edit/${tool}`, [line()], async (t) => {
    await t.select();
    await t.activate(tool);
    if (tool === "offset") {
      await t.cmd("20");
      await t.click(200, 300);
    } else {
      await t.click(150, 250);
      if (tool === "rotate") await t.cmd("90");
      else if (tool === "scale") await t.cmd("2");
      else if (tool === "mirror") await t.click(150, 400);
      else await t.click(180, 290);
    }
    const copying = ["copy", "mirror", "offset"].includes(tool);
    const s = await t.expectState((s) =>
      copying
        ? s?.entities.length === 2
        : JSON.stringify(s?.entities) !== JSON.stringify(t.initial.entities),
    );
    const changed = copying ? s.entities[1] : s.entities[0];
    assert.notDeepEqual(changed.points, t.initial.entities[0].points);
    if (tool === "move") assert.ok(Math.abs(changed.points[0].x - 180) < 0.01);
    if (tool === "scale") assert.ok(Math.abs(changed.points[1].x - 350) < 0.01);
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
await scenario("edit/erase", [line()], async (t) => {
  await t.select();
  await t.activate("erase");
  await t.cmd("");
  await t.expectState((s) => s?.entities.length === 0);
  await t.undoRedo();
});
await scenario(
  "edit/erase-viewport-with-children",
  [
    viewport(),
    line(
      "child",
      [
        [150, 250],
        [250, 250],
      ],
      { viewportId: "vp" },
    ),
  ],
  async (t) => {
    await t.select(100, 300);
    await t.activate("erase");
    await t.cmd("");
    await t.expectState((s) => s?.entities.length === 0);
    await t.undoRedo();
  },
);
await scenario(
  "edit/join",
  [
    line("a", [
      [150, 250],
      [250, 250],
    ]),
    line("b", [
      [250, 250],
      [350, 300],
    ]),
  ],
  async (t) => {
    await t.activate("join");
    await t.click(200, 250);
    await t.click(300, 275);
    await t.cmd("");
    const s = await t.expectState((s) => s?.entities.length === 1);
    assert.equal(s.entities[0].type, "polyline");
    assert.equal(s.entities[0].points.length, 3);
    await t.undoRedo();
  },
);
await scenario("edit/explode", [rect()], async (t) => {
  await t.select(200, 200);
  await t.activate("explode");
  await t.cmd("");
  const s = await t.expectState((s) => s?.entities.length === 4);
  assert.ok(s.entities.every((e) => e.type === "line"));
  await t.undoRedo();
});
for (const tool of ["pinsert", "pdelete"])
  await scenario(`edit/${tool}`, [rect()], async (t) => {
    await t.select(200, 200);
    await t.activate(tool);
    await t.click(
      tool === "pinsert" ? 250 : 150,
      tool === "pinsert" ? 185 : 200,
    );
    const s = await t.expectState((s) => s?.entities[0]?.type === "polyline");
    assert.equal(s.entities[0].points.length, tool === "pinsert" ? 5 : 3);
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
for (const tool of ["trim", "extend"])
  await scenario(
    `edit/${tool}`,
    [
      line("boundary", [
        [300, 180],
        [300, 400],
      ]),
      line("target", [
        [150, 280],
        [tool === "trim" ? 400 : 240, 280],
      ]),
    ],
    async (t) => {
      await t.activate(tool);
      await t.click(300, 200);
      await t.cmd("");
      await t.click(tool === "trim" ? 350 : 230, 280);
      const s = await t.expectState(
        (s) =>
          Math.abs(
            s?.entities.find((e) => e.id === "target")?.points[1].x - 300,
          ) < 0.01,
      );
      assert.equal(s.entities.length, 2);
      await t.page.keyboard.press("Escape");
      await t.undoRedo();
    },
  );
for (const tool of ["fillet", "chamfer"])
  await scenario(
    `edit/${tool}`,
    [
      line("a", [
        [150, 300],
        [350, 300],
      ]),
      line("b", [
        [300, 180],
        [300, 400],
      ]),
    ],
    async (t) => {
      await t.activate(tool);
      await t.cmd("20");
      await t.click(180, 300);
      await t.click(300, 220);
      const s = await t.expectState((s) => s?.entities.length === 3);
      assert.equal(s.entities[2].type, tool === "fillet" ? "arc" : "line");
      await t.page.keyboard.press("Escape");
      await t.undoRedo();
    },
  );
for (const tool of ["mask", "replace"])
  await scenario(`pdf/${tool}`, [], async (t) => {
    await t.activate(tool);
    await t.drag([55, 40], [185, 68]);
    if (tool === "replace") await t.text("ERSATT TEXT");
    const s = await t.expectState((s) => s?.entities.length === 1);
    assert.equal(s.entities[0].type, tool);
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
for (const tool of ["extract", "coverLine", "eraseLine", "eraseText"])
  await scenario(`pdf/${tool}`, [], async (t) => {
    const beforeCanvas = await t.page
      .locator("#pdfcanvas")
      .evaluate((c) => c.toDataURL());
    await t.activate(tool);
    await t.click(
      tool === "eraseText" ? 100 : 170,
      tool === "eraseText" ? 54 : 120,
    );
    const s = await t.expectState((s) => s?.entities.length === 1);
    assert.equal(
      s.entities[0].type,
      tool.startsWith("erase") ? "pdfErase" : "line",
    );
    if (tool === "coverLine") assert.equal(s.entities[0].color, "#ffffff");
    if (tool.startsWith("erase")) {
      await t.page.waitForFunction(
        () =>
          document.querySelector("#saveStatus").textContent ===
          "Sparat i webbläsaren",
      );
      await delay(200);
      assert.notEqual(
        await t.page.locator("#pdfcanvas").evaluate((c) => c.toDataURL()),
        beforeCanvas,
        "source PDF raster must change",
      );
      const event = t.page.waitForEvent("download");
      await t.page.locator("#export").click();
      const exported = await event;
      const document = await PDFDocument.load(
        await fs.readFile(await exported.path()),
      );
      const page = document.getPage(0);
      const content = pageContent(document, page);
      if (tool === "eraseText")
        assert.ok(
          removableTexts(content, document, page).every(
            (t) => !t.text.includes("SOURCE_TEXT"),
          ),
        );
      else assert.equal(removableLines(content).length, 1);
    }
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
await scenario("selection/appearance-and-opacity", [line()], async (t) => {
  await t.select();
  await t.page.locator("#color").fill("#b3261e");
  await t.page.locator("#color").dispatchEvent("change");
  await t.expectState((s) => s?.entities[0].color === "#b3261e");
  const before = await t.state();
  await t.page.locator("#transparency").fill("45");
  await t.expectState((s) => s?.entities[0].opacity === 0.55);
  await t.undoRedo(before);
});
await scenario("selection/delete-button", [line()], async (t) => {
  await t.select();
  await t.page.locator("#delete").click();
  await t.expectState((s) => s?.entities.length === 0);
  await t.undoRedo();
});
await scenario(
  "selection/text-edit",
  [entity("text", "text", [[180, 250]], { text: "Före" })],
  async (t) => {
    await t.select(190, 245);
    await t.page.locator("#editText").click();
    await t.text("Efter ÅÄÖ");
    await t.expectState((s) => s?.entities[0].text === "Efter ÅÄÖ");
    await t.undoRedo();
  },
);
await scenario("selection/grip-exact-coordinate", [line()], async (t) => {
  await t.select();
  await t.click(250, 250);
  await t.cmd("@50,0");
  const s = await t.expectState(
    (s) => Math.abs(s?.entities[0].points[1].x - 300) < 0.01,
  );
  assert.equal(s.entities[0].points[0].x, 150);
  await t.undoRedo();
});
await scenario("selection/drag-cancel-and-commit", [line()], async (t) => {
  await t.select();
  const a = await t.screen(200, 250),
    b = await t.screen(240, 280);
  await t.page.mouse.move(a.x, a.y);
  await t.page.mouse.down();
  await t.page.mouse.move(b.x, b.y, { steps: 5 });
  await t.page.keyboard.press("Escape");
  await t.page.mouse.up();
  assert.deepEqual((await t.state()).entities, t.initial.entities);
  await t.drag([200, 250], [240, 280]);
  await t.expectState((s) => Math.abs(s?.entities[0].points[0].x - 190) < 0.01);
  await t.undoRedo();
});
await scenario(
  "selection/group-ungroup",
  [
    line("a"),
    line("b", [
      [150, 300],
      [250, 300],
    ]),
  ],
  async (t) => {
    await t.select();
    await t.page.keyboard.down("Shift");
    await t.click(200, 300);
    await t.page.keyboard.up("Shift");
    await t.click(200, 250, { button: "right" });
    await t.page
      .getByRole("menuitem", { name: "Gruppera", exact: true })
      .click();
    const s = await t.expectState((s) => s?.entities.every((e) => e.groupId));
    assert.equal(s.entities[0].groupId, s.entities[1].groupId);
    const before = await t.state();
    await t.click(200, 250, { button: "right" });
    await t.page
      .getByRole("menuitem", { name: "Lös upp grupp", exact: true })
      .click();
    await t.expectState((s) => s?.entities.every((e) => !e.groupId));
    await t.undoRedo(before);
  },
);
await scenario("input/exact-line-and-length", [], async (t) => {
  await t.activate("line");
  await t.cmd("#150;350");
  await t.cmd("@100;0");
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.deepEqual(s.entities[0].points, [pt(150, 250), pt(250, 250)]);
  await t.page.keyboard.press("Escape");
  await t.undoRedo();
});
await scenario("view/rotation-navigation-and-light-ui", [line()], async (t) => {
  await t.page.locator("[data-category=pdf]").click();
  await t.page.locator("#rotatePageCW").click();
  await t.expectState((s) => s?.rotations?.[1] === 90);
  assert.match(
    (await t.page.locator("#sheet").getAttribute("style")).replace(/\s/g, ""),
    /matrix\(0,1,-1,0,600,0\)/,
  );
  await t.undoRedo();
  await t.page.locator("#rotatePageCCW").click();
  await t.expectState((s) => s?.rotations?.[1] === 0);
  await t.page.locator("[data-category=view]").click();
  const before = await t.page.locator("#zoom").textContent();
  await t.page.locator("#zoomIn").click();
  assert.notEqual(await t.page.locator("#zoom").textContent(), before);
  await t.page.locator("#zoomOut").click();
  assert.equal(await t.page.locator("#zoom").textContent(), before);
  await t.page.locator("#fit").click();
  await t.page.locator("#fitAll").click();
  await t.page.locator("#togglePages").click();
  assert.equal(await t.page.locator("#pages").isVisible(), false);
  await t.page.locator("#togglePages").click();
  await t.page.emulateMedia({ colorScheme: "dark" });
});
await scenario("pdf/block-import-library-place-copy", [], async (t) => {
  await t.activate("block");
  await t.page.locator("#blockInput").setInputFiles({
    name: "Testblock.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await t.page.locator(".block-choice").waitFor();
  await t.page.locator(".block-choice").click();
  await t.click(150, 200);
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.equal(s.entities[0].type, "block");
  await t.undoRedo();
  await t.select(170, 240);
  await t.page.locator("#blockSize").fill("50");
  await t.page.locator("#blockSize").press("Tab");
  await t.expectState((s) => s?.entities[0].blockWidth === 300);
  await t.page.locator("#blockRotation").fill("90");
  await t.page.locator("#blockRotation").press("Tab");
  await t.expectState((s) => s?.entities[0].rotation === 90);
  await t.page.locator("#copyBlock").click();
  await t.click(350, 300);
  await t.expectState((s) => s?.entities.length === 2);
});
await scenario("pdf/stamp-template-place", [], async (t) => {
  await t.activate("stamp");
  await t.page.locator("#stampPdfInput").setInputFiles({
    name: "Mall.pdf",
    mimeType: "application/pdf",
    buffer: stampBytes,
  });
  await t.page.locator("#placePdfStamp").waitFor();
  await t.page
    .getByRole("textbox", { name: "Granskare", exact: true })
    .fill("Andreas");
  await t.page.locator("#placePdfStamp").click();
  await t.page.waitForFunction(() =>
    document.querySelector("#toolname").textContent.includes("PDF-block"),
  );
  await t.click(100, 150);
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.equal(s.entities[0].isPdfStamp, true);
  const stamp = await PDFDocument.load(
    Buffer.from(s.entities[0].blockPdf, "base64"),
  );
  assert.equal(stamp.getForm().getFields().length, 0);
  await t.undoRedo();
});
await scenario("file/editable-save-reopen-and-export", [line()], async (t) => {
  let event = t.page.waitForEvent("download");
  await t.page.locator("#save").click();
  const saved = await event;
  const file = await saved.path();
  const data = await fs.readFile(file);
  assert.equal((await PDFDocument.load(data)).getPageCount(), 1);
  await t.page.locator("#pdfInput").setInputFiles({
    name: "Reopened.pdf",
    mimeType: "application/pdf",
    buffer: data,
  });
  await t.page.waitForFunction(
    () =>
      document.querySelector("#filename").textContent === "Reopened.pdf" &&
      document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
  );
  const state = await t.state();
  assert.equal(state.entities.length, 1);
  event = t.page.waitForEvent("download");
  await t.page.locator("#export").click();
  const exported = await event;
  assert.match(exported.suggestedFilename(), /-markerad\.pdf$/);
  assert.equal(
    (
      await PDFDocument.load(await fs.readFile(await exported.path()))
    ).getPageCount(),
    1,
  );
});

for (const tool of ["rotate", "scale"])
  await scenario(`edit/${tool}-reference`, [line()], async (t) => {
    await t.select();
    await t.activate(tool);
    await t.click(150, 250);
    await t.cmd("R");
    await t.cmd(tool === "scale" ? "100" : "45");
    await t.cmd(tool === "scale" ? "200" : "90");
    const s = await t.expectState(
      (s) => JSON.stringify(s?.entities) !== JSON.stringify(t.initial.entities),
    );
    const [a, b] = s.entities[0].points;
    if (tool === "scale") assert.ok(Math.abs(b.x - a.x - 200) < 0.01);
    else assert.ok(Math.abs(b.y - a.y + (b.x - a.x)) < 0.01);
    await t.undoRedo();
  });
await scenario("input/numeric-line-length", [], async (t) => {
  await t.activate("line");
  await t.click(150, 250);
  const target = await t.screen(300, 250);
  await t.page.mouse.move(target.x, target.y);
  await t.cmd("80");
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.ok(Math.abs(s.entities[0].points[1].x - 230) < 0.01);
  await t.page.keyboard.press("Escape");
  await t.undoRedo();
});
for (const aid of ["ortho", "polar"])
  await scenario(`input/${aid}`, [], async (t) => {
    await t.activate("line");
    await t.page.keyboard.press(aid === "ortho" ? "F8" : "F10");
    await t.click(150, 250);
    await t.click(250, aid === "ortho" ? 285 : 253);
    const s = await t.expectState((s) => s?.entities.length === 1);
    assert.ok(Math.abs(s.entities[0].points[1].y - 250) < 0.01);
    await t.page.keyboard.press("Escape");
    await t.undoRedo();
  });
await scenario("input/pdf-endpoint-snap", [], async (t) => {
  await t.page.locator("#snap").click();
  await t.activate("line");
  await t.click(61, 119);
  await t.click(280, 220);
  const s = await t.expectState((s) => s?.entities.length === 1);
  assert.deepEqual(s.entities[0].points[0], pt(60, 120));
  await t.page.keyboard.press("Escape");
  await t.undoRedo();
});
await scenario("input/object-tracking", [line()], async (t) => {
  await t.page.locator("#snap").click();
  await t.page.locator("#otrack").click();
  await t.activate("line");
  await t.click(350, 350);
  const anchor = await t.screen(150, 250);
  await t.page.mouse.move(anchor.x, anchor.y);
  await delay(550);
  await t.click(153, 430);
  const s = await t.expectState((s) => s?.entities.length === 2);
  assert.ok(Math.abs(s.entities[1].points[1].x - 150) < 0.01);
  await t.page.keyboard.press("Escape");
  await t.undoRedo();
});
await scenario("input/escape-cancels-unfinished-tools", [], async (t) => {
  for (const tool of [
    "line",
    "rect",
    "circle",
    "ellipse",
    "arc",
    "cloud",
    "stamp",
    "leader",
    "dim",
    "viewport",
    "calibrate",
  ]) {
    await t.activate(tool);
    await t.click(150, 250);
    await t.page.keyboard.press("Escape");
    assert.equal(await t.page.locator("#toolname").textContent(), "Markera");
  }
  await t.activate("freehand");
  const a = await t.screen(150, 250),
    b = await t.screen(250, 300);
  await t.page.mouse.move(a.x, a.y);
  await t.page.mouse.down();
  await t.page.mouse.move(b.x, b.y, { steps: 5 });
  await t.page.keyboard.press("Escape");
  await t.page.mouse.up();
  assert.deepEqual((await t.state()).entities, []);
  assert.equal(await t.page.locator("#undo").isDisabled(), true);
});
await scenario(
  "selection/window-and-crossing",
  [
    line("a"),
    line("b", [
      [150, 300],
      [250, 300],
    ]),
  ],
  async (t) => {
    await t.drag([120, 220], [280, 280]);
    await t.page.keyboard.press("Delete");
    await t.expectState(
      (s) => s?.entities.length === 1 && s.entities[0].id === "b",
    );
    await t.page.locator("#undo").click();
    await t.expectState((s) => s?.entities.length === 2);
    await t.drag([200, 320], [120, 230]);
    await t.page.keyboard.press("Delete");
    await t.expectState((s) => s?.entities.length === 0);
    await t.undoRedo();
  },
);
await scenario(
  "selection/viewport-drag-children",
  [
    viewport(),
    line(
      "child",
      [
        [150, 250],
        [250, 250],
      ],
      { viewportId: "vp" },
    ),
  ],
  async (t) => {
    await t.select(100, 300);
    await t.drag([100, 300], [130, 330]);
    const s = await t.expectState(
      (s) => Math.abs(s?.entities[0].points[0].x - 130) < 0.01,
    );
    assert.ok(Math.abs(s.entities[1].points[0].x - 180) < 0.01);
    await t.undoRedo();
  },
);
await scenario("view/pan-and-wheel-zoom", [], async (t) => {
  const before = await t.page.locator("#sheet").getAttribute("style");
  await t.page.locator("#viewport").click({ position: { x: 600, y: 500 } });
  await t.page.keyboard.down("Space");
  await t.drag([450, 450], [480, 470]);
  await t.page.keyboard.up("Space");
  assert.notEqual(await t.page.locator("#sheet").getAttribute("style"), before);
  assert.equal(await t.page.locator("#toolname").textContent(), "Markera");
  const zoom = await t.page.locator("#zoom").textContent();
  await t.page.keyboard.down("Control");
  await t.page.mouse.wheel(0, -150);
  await t.page.keyboard.up("Control");
  await delay(150);
  assert.notEqual(await t.page.locator("#zoom").textContent(), zoom);
  assert.deepEqual((await t.state()).entities, []);
});
await scenario("view/multipage-navigation", [], async (t) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 600]);
  pdf.addPage([600, 600]);
  await t.page.locator("#pdfInput").setInputFiles({
    name: "Pages.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await t.page.waitForFunction(
    () =>
      document.querySelector("#filename").textContent === "Pages.pdf" &&
      document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
  );
  await t.page.locator("#inspector-pages-tab").click();
  assert.equal(await t.page.locator(".inspector-page-list button").count(), 2);
  await t.page.locator("#nextPage").click();
  await t.page.waitForFunction(
    () =>
      document.querySelector("#pageNumber").value === "2" &&
      document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
  );
  await t.page.locator("#prevPage").click();
  await t.page.waitForFunction(
    () =>
      document.querySelector("#pageNumber").value === "1" &&
      document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
  );
  const p = await t.screen(300, 300);
  await t.page.mouse.move(p.x, p.y);
  await t.page.mouse.wheel(0, 650);
  await t.page.waitForFunction(
    () =>
      document.querySelector("#pageNumber").value === "2" &&
      document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
  );
});
await scenario("file/new-pdf-and-save-as", [], async (t) => {
  await t.page.locator("#fileMenu summary").click();
  await t.page.locator("#newPdf").click();
  await t.page.locator("#newPdfName").fill("Ny kontroll");
  await t.page.locator("#newPdfForm button[type=submit]").click();
  await t.page.waitForFunction(
    () =>
      document.querySelector("#filename").textContent === "Ny kontroll.pdf" &&
      document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
  );
  await t.page.locator("#fileMenu summary").click();
  const event = t.page.waitForEvent("download");
  await t.page.locator("#saveAs").click();
  assert.equal((await event).suggestedFilename(), "Ny kontroll.pdf");
  await t.page
    .locator(".document-tab-item")
    .last()
    .locator(".document-close")
    .click();
  await t.page.waitForFunction(() =>
    document.querySelector("#filename").textContent.startsWith("Toolcheck-"),
  );
});
await scenario("preferences/quick-tools-save-restore", [], async (t) => {
  await t.page.locator(".quick-manage").click();
  await t.page.locator(".quick-tools-dialog [name=name]").fill("Kontrollpenna");
  await t.page.locator(".quick-tools-dialog [name=tool]").selectOption("line");
  await t.page.locator(".quick-tools-dialog button[type=submit]").click();
  assert.equal(
    await t.page.getByRole("button", { name: /^Kontrollpenna/ }).count(),
    1,
  );
  await t.page.reload();
  await t.page.waitForFunction(
    () =>
      document.querySelector("#saveStatus").textContent ===
      "Sparat i webbläsaren",
  );
  await t.page.getByRole("button", { name: /^Kontrollpenna/ }).click();
  assert.equal(await t.page.locator("#toolname").textContent(), "Linje");
});

await scenario(
  "pdf/block-library-rename-search-and-persistence",
  [],
  async (t) => {
    await t.activate("block");
    await t.page.locator("#blockInput").setInputFiles({
      name: "Bibliotek.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
    await t.page.locator(".block-rename").waitFor();
    await t.page.locator(".block-rename").click();
    await t.answer("Detalj A");
    await t.page
      .getByRole("button", { name: "Placera Detalj A", exact: true })
      .waitFor();
    await t.page.locator("#blockSearch").fill("saknas");
    assert.equal(await t.page.locator(".block-choice").count(), 0);
    await t.page.locator("#blockSearch").fill("Detalj");
    await t.page.locator(".block-choice").click();
    await t.click(150, 200);
    await t.expectState((s) => s?.entities.length === 1);
    await t.page.locator("#saveLibraryBlock").click();
    await t.answer("Detalj B");
    await t.activate("block");
    await t.page
      .getByRole("button", { name: "Placera Detalj B", exact: true })
      .waitFor();
    assert.equal(await t.page.locator(".block-choice").count(), 2);
    await t.page.locator("#closeBlockLibrary").click();
    await t.page.reload();
    await t.page.waitForFunction(
      () =>
        document.querySelector("#saveStatus").textContent ===
        "Sparat i webbläsaren",
    );
    await t.activate("block");
    await t.page.locator(".block-choice").nth(1).waitFor();
    assert.equal(await t.page.locator(".block-choice").count(), 2);
  },
);

for (const type of ["mask", "replace"])
  await scenario(
    `edit/erase-${type}`,
    [
      entity(
        type,
        type,
        [
          [150, 200],
          [350, 350],
        ],
        { text: "Ersättning" },
      ),
    ],
    async (t) => {
      await t.select(200, 250);
      await t.activate("erase");
      await t.cmd("");
      await t.expectState((s) => s?.entities.length === 0);
      await t.undoRedo();
    },
  );

await scenario(
  "file/measurement-scale-public-roundtrip",
  [
    viewport(),
    entity(
      "dim",
      "dimension",
      [
        [150, 250],
        [250, 250],
        [200, 300],
      ],
      { viewportId: "vp" },
    ),
  ],
  async (t) => {
    let event = t.page.waitForEvent("download");
    await t.page.locator("#save").click();
    const download = await event,
      bytes = await fs.readFile(await download.path());
    await t.page.locator("#pdfInput").setInputFiles({
      name: "Measure-saved.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
    await t.page.waitForFunction(
      () =>
        document.querySelector("#filename").textContent ===
          "Measure-saved.pdf" &&
        document.querySelector("#saveStatus").textContent ===
          "Sparat i webbläsaren",
    );
    let state = await t.state();
    assert.equal(state.entities.filter((e) => e.type === "dim").length, 1);
    assert.equal(state.entities.filter((e) => e.type === "viewport").length, 1);
    assert.equal(state.scales[1], 10);
    const doc = await PDFDocument.load(bytes),
      k = PDFName.of;
    doc.catalog.delete(k("LiraPDF"));
    const annotation = doc.getPage(0).node.Annots().lookup(0, PDFDict);
    annotation
      .lookup(k("Measure"), PDFDict)
      .lookup(k("X"))
      .lookup(0, PDFDict)
      .set(k("C"), PDFNumber.of(5));
    await t.page.locator("#pdfInput").setInputFiles({
      name: "Measure-public.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await doc.save()),
    });
    await t.page.waitForFunction(
      () =>
        document.querySelector("#filename").textContent ===
          "Measure-public.pdf" &&
        document.querySelector("#saveStatus").textContent ===
          "Sparat i webbläsaren",
    );
    state = await t.state();
    assert.equal(
      state.entities.find((e) => e.type === "dim").measurementScale,
      5,
    );
    assert.equal(state.scales[1], 10);
    assert.equal(
      state.entities.find((e) => e.type === "viewport").denominator,
      100,
    );
    assert.match(
      await t.page
        .locator('#overlay g[data-id="dimension"] text')
        .textContent(),
      /500 mm/,
    );
    event = t.page.waitForEvent("download");
    await t.page.locator("#save").click();
    const final = await PDFDocument.load(
      await fs.readFile(await (await event).path()),
    );
    assert.equal(final.getPage(0).node.Annots().size(), 1);
    assert.equal(final.getPage(0).node.lookup(k("VP")).size(), 2);
    assert.equal(
      final
        .getPage(0)
        .node.Annots()
        .lookup(0, PDFDict)
        .lookup(k("Measure"), PDFDict)
        .lookup(k("X"))
        .lookup(0, PDFDict)
        .lookup(k("C"))
        .asNumber(),
      5,
    );
  },
  { scales: { 1: 10 } },
);

await browser.close();
if (!results.length)
  throw Error("TOOL_FILTER matchade inga verktygskontroller.");
await fs.writeFile(
  path.join(artifacts, "results.json"),
  JSON.stringify(results, null, 2),
);
console.log(
  `${results.filter((r) => r.ok).length}/${results.length} tool scenarios passed. Artifacts: ${artifacts}`,
);
if (results.some((r) => !r.ok)) process.exitCode = 1;
