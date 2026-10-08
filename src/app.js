import {
  expandGroups,
  groupObjects,
  ungroupObjects,
  normalizeGroups,
  copyGroupIds,
} from "./groups.js";
import { setupObjectMenu } from "./object-menu.js";
let objectMenu;
import { setupQuickTools } from "./quick-tools.js";
let quickToolBar;
import { appendStrokePoint, completeStroke } from "./freehand.js";
import { pageRotation, normalizeRotation } from "./page-rotation.js";
import { createDocumentScroll, scrollPosition } from "./document-scroll.js";
import { documentScrollMetrics, setupScrollbars } from "./scrollbars.js";
import { createDetailRenderer } from "./pdf-detail.js";
const pdfDetail = createDetailRenderer(document.getElementById("sheet"));
import { setupPWA } from "./pwa.js";
import { setupFileHandling } from "./file-handling.js";
import { initializeLiraShell } from "./lira-shell.js";
import { textRemovalTargets, textTargetAt } from "./pdf-text-edit.js";
let removableTextTargets = [];
import { moveGrip, gripLengthPoint } from "./grips.js";
let activeGrip = null;
import { exactPoint, referenceValue } from "./command-input.js";
let lastTool = null,
  spacePanned = false;
import { inSelection, mergeSelection } from "./selection.js";
const selection = new Set();
import {
  transformEntity,
  joinEntities,
  explodeEntity,
  vertexEdit,
  trimLine,
  cornerLines,
} from "./advanced-editing.js";
const transformTools = [
  "move",
  "copy",
  "offset",
  "rotate",
  "scale",
  "mirror",
  "erase",
  "join",
  "explode",
  "trim",
  "extend",
  "fillet",
  "chamfer",
  "pinsert",
  "pdelete",
];
function editTypes(t) {
  if (t === "offset") return offsetTypes;
  if (["rotate", "scale", "mirror"].includes(t))
    return ["line", "circle", "rect", "arc", "polyline"];
  if (["trim", "extend"].includes(t))
    return ["line", "rect", "polyline", "circle", "arc"];
  if (t === "join") return ["line", "polyline"];
  if (["explode", "pinsert", "pdelete"].includes(t))
    return ["rect", "polyline"];
  if (["fillet", "chamfer"].includes(t)) return ["line"];
  return editableTypes;
}
function editPhase(t) {
  if (["offset", "fillet", "chamfer"].includes(t)) return "distance";
  if (["trim", "extend"].includes(t)) return "cut";
  if (["pinsert", "pdelete"].includes(t)) return "vertex";
  if (["erase", "join", "explode"].includes(t)) return "select";
  return "base";
}
import {
  editableTypes,
  offsetTypes,
  translateEntity,
  offsetEntity,
} from "./editing.js";
let editOperation = null;
import "./style.css";
import { blankPdf } from "./blank-pdf.js";
import {
  polarPoint,
  trackingPoint,
  createTracker,
  snapSymbol,
} from "./drawing-aids.js";
const tracker = createTracker();
let polar = true,
  otrack = true,
  polarAngle = 45,
  trackingAnchors = [],
  aidGuides = [],
  trackTimer;
function clearTracking() {
  tracker.clear();
  trackingAnchors = [];
  aidGuides = [];
  clearTimeout(trackTimer);
}
import {
  viewportCaption,
  viewportAt,
  entityScale,
  changeViewportScale,
  transformChildren,
  mmPerPoint,
} from "./viewports.js";
import { findRemovableLine, applyLineRemovals } from "./pdf-line-edit.js";
import { blockLibrary } from "./block-library.js";
import { blockPage, blockCorners } from "./pdf-block.js";
let pendingBlock = null;
import { documentTabs, reorderDocuments } from "./document-tabs.js";
import { documentChanged, documentSnapshot } from "./document-state.js";
import { readEditablePdf, saveEditablePdf } from "./editable-pdf.js";
import {
  choosePdfTarget,
  writePdfFile,
  pdfFilename,
  persistableFileHandle,
} from "./pdf-file-save.js";
import {
  extractSegments,
  nearestSnap,
  nearestSegment,
} from "./pdf-snapping.js";
import { OPS } from "pdfjs-dist";
import {
  distance,
  box,
  constrain,
  arcPoints,
  dimension,
  primitives,
  validateProject,
} from "./core.js";
import { loadPdf, demoPdf, exportPdf } from "./pdf.js";
import { readSaved, writeSaved } from "./storage.js";
const $ = (id) => document.getElementById(id),
  NS = "http://www.w3.org/2000/svg";
const tools = [
  ["select", "↖", "Markera", "ESC"],
  ["block", "", "PDF-block", "BLOCK"],
  ["line", "╱", "Linje", "L"],
  ["freehand", "✎", "Frihand", "FH"],
  ["circle", "○", "Cirkel", "C"],
  ["rect", "▭", "Rektangel", "REC"],
  ["arc", "◜", "Båge", "A"],
  ["text", "T", "Text", "T"],
  ["leader", "↗", "Leader", "LE"],
  ["viewport", "", "Viewport", "VP"],
  ["dim", "↔", "Mått", "DIM"],
  ["move", "", "Flytta", "M"],
  ["copy", "", "Kopiera", "CO"],
  ["offset", "", "Offset", "O"],
  ["rotate", "", "Rotera", "RO"],
  ["scale", "", "Skala", "SC"],
  ["mirror", "", "Spegla", "MI"],
  ["trim", "", "Trimma", "TR"],
  ["extend", "", "Förläng", "EX"],
  ["erase", "", "Radera", "E"],
  ["join", "", "Sammanfoga", "J"],
  ["explode", "", "Dela upp", "X"],
  ["fillet", "", "Avrunda", "F"],
  ["chamfer", "", "Fasa", "CHA"],
  ["pinsert", "", "Lägg till hörn", "PI"],
  ["pdelete", "", "Ta bort hörn", "PD"],
  ["mask", "▧", "Maska", "MASK"],
  ["extract", "", "Hämta linje", "GETLINE"],
  ["coverLine", "", "Täck linje", "COVERLINE"],
  ["eraseLine", "", "Ta bort PDF-linje", "ERASELINE"],
  ["eraseText", "", "Ta bort PDF-text", "ERASETEXT"],
];
const toolCategories = {
  rotate: "edit",
  scale: "edit",
  mirror: "edit",
  trim: "edit",
  extend: "edit",
  erase: "edit",
  join: "edit",
  explode: "edit",
  fillet: "edit",
  chamfer: "edit",
  pinsert: "edit",
  pdelete: "edit",
  move: "edit",
  copy: "edit",
  offset: "edit",
  block: "create",
  line: "create",
  freehand: "create",
  circle: "create",
  rect: "create",
  arc: "create",
  text: "create",
  leader: "create",
  mask: "pdf",
  extract: "pdf",
  coverLine: "pdf",
  eraseLine: "pdf",
  eraseText: "pdf",
  replace: "pdf",
  viewport: "measure",
  dim: "measure",
  calibrate: "measure",
};
let activeCategory = "create";
function showCategory(category) {
  activeCategory = category;
  for (const button of document.querySelectorAll("[data-category]")) {
    const active = button.dataset.category === category;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active) $("toolRibbon").setAttribute("aria-labelledby", button.id);
  }
  for (const b of document.querySelectorAll("[data-tool]"))
    b.hidden =
      b.dataset.tool !== "select" &&
      toolCategories[b.dataset.tool] !== category;
  $("replace").hidden = category !== "pdf";
  $("rotatePageCW").hidden = $("rotatePageCCW").hidden = category !== "pdf";
  $("measureCalibrate").hidden = category !== "measure";
}
for (const button of document.querySelectorAll("[data-category]")) {
  button.onclick = () => {
    if (busy || pendingDialog) return;
    if (tool !== "select") setTool("select");
    showCategory(button.dataset.category);
  };
  button.onkeydown = (event) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const buttons = [...document.querySelectorAll("[data-category]")];
    let i = buttons.indexOf(button);
    i =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (i +
              (["ArrowRight", "ArrowDown"].includes(event.key)
                ? 1
                : buttons.length - 1)) %
            buttons.length;
    buttons[i].click();
    buttons[i].focus();
  };
}
const names = Object.fromEntries(tools.map((t) => [t[0], t[2]]));
Object.assign(names, {
  polyline: "Polylinje",
  calibrate: "Kalibrera",
  replace: "Täck och ersätt",
});
let state = { entities: [], scales: {} },
  pdf,
  bytes,
  name = "Exempelritning.pdf",
  pageNo = 1,
  viewport,
  tool = "select",
  points = [],
  hover = null,
  selected = null,
  zoom = 1,
  pan = { x: 20, y: 20 },
  ortho = false,
  snap = true,
  space = false,
  drag = null,
  renderTask = null,
  epoch = 0,
  textItems = [],
  undoStack = [],
  redoStack = [],
  busy = false,
  saveTimer,
  pendingDialog = null;
const documents = [];
let activeId = null,
  restoring = false,
  pdfSegments = [],
  snapHit = null;
const counts = {
  viewport: 2,
  line: 2,
  circle: 2,
  rect: 2,
  arc: 3,
  text: 1,
  leader: 3,
  dim: 3,
  calibrate: 2,
  replace: 2,
  mask: 2,
};
const clone = (x) => structuredClone(x),
  current = () => state.entities.find((e) => e.id === selected),
  pageEntities = () => state.entities.filter((e) => e.page === pageNo);
let toastTimer;
function toast(t) {
  $("toast").textContent = t;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      $("toast").hidden = true;
    },
    Math.min(14000, Math.max(5000, t.length * 45)),
  );
}
function error(e) {
  console.error(e);
  toast(e.message || String(e));
}
function download(data, type, filename) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function base64(data) {
  let s = "";
  for (let i = 0; i < data.length; i += 32768)
    s += String.fromCharCode(...data.subarray(i, i + 32768));
  return btoa(s);
}
function autosave() {
  if (restoring) return;
  clearTimeout(saveTimer);
  $("saveStatus").textContent = "Sparar …";
  saveTimer = setTimeout(async () => {
    try {
      stashDocument();
      await writeSaved({
        version: 2,
        activeId,
        documents: documents.map((d) => ({
          id: d.id,
          name: d.name,
          bytes: d.bytes,
          state: clone(d.state),
          pageNo: d.pageNo,
          savedState: d.savedState,
          fileHandle: persistableFileHandle(d.fileHandle),
        })),
      });
      $("saveStatus").textContent = "Sparat i webbläsaren";
    } catch (e) {
      $("saveStatus").textContent = "Autosparande misslyckades";
      toast("Kunde inte autospara. Spara PDF:en.");
    }
  }, 350);
}
function removalKey(s) {
  return JSON.stringify(s.entities.filter((e) => e.type === "pdfErase"));
}
function commit(next) {
  normalizeGroups(next.entities);
  const redraw = removalKey(state) !== removalKey(next);
  undoStack.push(clone(state));
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  state = next;
  documentTabsUI.updateChanges();
  refresh();
  autosave();
  if (redraw) showPage(pageNo, true);
  else view();
}
function history(redo = false) {
  objectMenu?.close();
  activeGrip = null;
  if (busy) return;
  const before = removalKey(state);
  const from = redo ? redoStack : undoStack,
    to = redo ? undoStack : redoStack;
  if (!from.length) return;
  clearTracking();
  to.push(clone(state));
  state = from.pop();
  documentTabsUI.updateChanges();
  editOperation = null;
  tool = "select";
  if (before !== removalKey(state)) showPage(pageNo, true);
  else view();
  selected = null;
  selection.clear();
  points = [];
  refresh();
  autosave();
}
function ask(title, help, value = "", numeric = false) {
  $("dialogTitle").textContent = title;
  $("dialogHelp").textContent = help;
  $("textInput").hidden = numeric;
  $("numberInput").hidden = !numeric;
  const input = $(numeric ? "numberInput" : "textInput");
  input.value = value;
  if (numeric) input.setAttribute("aria-label", title);
  return new Promise((resolve) => {
    pendingDialog = resolve;
    $("dialog").showModal();
    input.focus();
    input.select();
  });
}
$("cancelDialog").onclick = () => $("dialog").close("cancel");
$("dialog").addEventListener("close", () => {
  const result =
    $("dialog").returnValue === "ok"
      ? $("numberInput").hidden
        ? $("textInput").value
        : $("numberInput").value
      : null;
  pendingDialog?.(result);
  pendingDialog = null;
});
function setTool(t) {
  objectMenu?.close();
  activeGrip = null;
  if (busy || !pdf) return;
  if (t !== "select") lastTool = t;
  const previousIds = [...selection];
  editOperation = transformTools.includes(t)
    ? {
        ids: previousIds.filter((id) =>
          editTypes(t).includes(state.entities.find((e) => e.id === id)?.type),
        ),
        phase: "select",
        amount: null,
      }
    : null;
  if (editOperation?.ids.length) editOperation.phase = editPhase(t);
  if (["fillet", "chamfer"].includes(t)) {
    editOperation.ids = [];
    editOperation.phase = "distance";
  }
  clearTracking();
  if (drag?.kind === "entity") state = drag.before;
  drag = null;
  tool = t;
  if (toolCategories[t]) showCategory(toolCategories[t]);
  points = [];
  hover = null;
  selected = null;
  selection.clear();
  $("toolname").textContent = names[t];
  refresh();
}
for (const [id, icon, label, shortcut] of tools) {
  const b = document.createElement("button");
  b.className = "tool";
  b.dataset.tool = id;
  b.title = `${label} (${shortcut})`;
  const paths = {
    rotate: '<path d="M5 8a8 8 0 1 1-1 9M5 3v5h5"/>',
    scale:
      '<rect x="3" y="13" width="8" height="8"/><path d="M3 9V3h18v18h-6M12 12l7-7m-5 0h5v5"/>',
    mirror: '<path d="M12 2v20M8 5 2 19h6ZM16 5l6 14h-6Z"/>',
    trim: '<path d="M8 2v20M16 2v20M2 12h6m8 0h6m-12-3 4 6m0-6-4 6"/>',
    extend: '<path d="M19 3v18M2 12h17m-5-4 5 4-5 4"/>',
    erase: '<path d="m3 15 10-12 8 7-10 12H8ZM8 10l8 7"/>',
    join: '<path d="M2 16h8v-8h12M7 12l3 4 3-4"/>',
    explode: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
    fillet: '<path d="M3 21V11a8 8 0 0 1 8-8h10"/>',
    chamfer: '<path d="M3 21V11l8-8h10"/>',
    pinsert: '<path d="M2 20 12 6l10 14M12 2v8M8 6h8"/>',
    pdelete: '<path d="M2 20h20M8 6h8"/>',
    move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12"/><path d="M5 16H3V3h13v2"/>',
    offset: '<path d="M3 20V4h16M8 20V9h11M13 20v-6h6"/>',
    block:
      '<rect x="4" y="3" width="13" height="17"/><path d="M9 12h12m-6-6v12"/>',
    viewport:
      '<rect x="3" y="4" width="18" height="16" stroke-dasharray="3 2"/><path d="M8 9h8v6H8Z"/>',
    select: '<path d="m5 3 14 9-7 1-3 7Z"/>',
    freehand: '<path d="M3 17c3-10 5 7 8-3s4-10 5-5M14 7l5-5 3 3-5 5-4 1Z"/>',
    line: '<path d="M5 19 19 5"/><rect x="3" y="17" width="4" height="4"/><rect x="17" y="3" width="4" height="4"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    rect: '<rect x="3" y="5" width="18" height="14" rx="1"/>',
    arc: '<path d="M4 19A15 15 0 0 1 19 4"/><path d="M2 19h4M19 2v4"/>',
    text: '<path d="M5 5h14M12 5v15M8 20h8"/>',
    leader: '<path d="m3 20 9-12h9M3 14v6h6"/>',
    coverLine: '<path d="M4 18 18 4M7 21 21 7"/>',
    eraseText: '<path d="M4 4h14M11 4v15M7 19h8M16 12l6 6m0-6-6 6"/>',
    eraseLine: '<path d="M4 20 20 4M12 5l7 7M4 4l16 16"/>',
    extract:
      '<path d="M4 16 16 4m-1 9h6m-3-3v6"/><rect x="2" y="14" width="4" height="4"/><rect x="14" y="2" width="4" height="4"/>',
    mask: '<rect x="3" y="5" width="18" height="14"/><path d="m4 15 10-10m-4 14L21 8m-5 11 5-5"/>',
    dim: '<path d="M4 5v14M20 5v14M4 12h16m-12-3-4 3 4 3m8-6 4 3-4 3"/>',
  };
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[id]}</svg><span>${label}</span>`;
  b.onclick = () => (id === "block" ? library.open() : setTool(id));
  $("tools").append(b);
}
showCategory(activeCategory);
$("measureCalibrate").onclick = () => setTool("calibrate");
function scaleContext(p) {
  const owner = viewportAt(state.entities, pageNo, p);
  return {
    owner,
    scale: owner ? owner.denominator * mmPerPoint : state.scales[pageNo],
  };
}
function prompt() {
  const steps = {
    freehand: ["Håll ned och dra för att rita · Esc avslutar"],
    viewport: ["Välj viewportens första hörn", "Välj motsatt hörn"],
    block: ["Klicka för att placera PDF-block · Esc avslutar"],
    line: [
      "Välj startpunkt",
      "Välj nästa punkt · längd · @dx,dy · längd<vinkel · Esc avslutar",
    ],
    circle: ["Välj centrum", "Välj radiepunkt eller skriv radie"],
    rect: ["Välj första hörnet", "Välj motsatt hörn"],
    arc: [
      "Välj bågens startpunkt",
      "Välj en punkt på bågen",
      "Välj bågens slutpunkt",
    ],
    text: ["Välj textens placering"],
    leader: ["Välj pilspets", "Välj brytpunkt", "Välj textplacering"],
    dim: [
      "Välj första mätpunkten",
      "Välj andra mätpunkten",
      "Placera måttlinjen",
    ],
    calibrate: [
      "Välj första kalibreringspunkten",
      "Välj andra kalibreringspunkten",
    ],
    replace: ["Dra ett område runt texten"],
    coverLine: ["Välj PDF-linje att täcka med vitt · originalet finns kvar"],
    eraseText: [
      "Peka för att markera en PDF-text · klicka för att ta bort · Esc avslutar",
    ],
    eraseLine: ["Klicka på en fristående rak PDF-linje för att ta bort den"],
    extract: ["Välj PDF-linje att kopiera · originalet finns kvar"],
    mask: ["Dra ett område att täcka · originalinnehållet finns kvar"],
    select: [
      "Välj objekt eller dra ruta · vänster→höger: innanför · höger→vänster: korsande",
    ],
  };
  const selectedOwner =
    current()?.type === "viewport"
      ? current()
      : state.entities.find(
          (v) => v.type === "viewport" && v.id === current()?.viewportId,
        );
  const context = selectedOwner
    ? { owner: selectedOwner, scale: selectedOwner.denominator * mmPerPoint }
    : current()
      ? { owner: null, scale: state.scales[pageNo] }
      : scaleContext(points[0] || hover);
  const scaleText = context.owner
    ? `Viewport 1:${context.owner.denominator}`
    : context.scale
      ? `Papper 1:${Number((context.scale / mmPerPoint).toFixed(2))}`
      : "Papper · ej kalibrerat";
  const editPrompt =
    editOperation &&
    {
      select: `${["trim", "extend"].includes(tool) ? "Välj gränser" : "Välj objekt"} (${editOperation.ids.length}) · Enter fortsätter`,
      base:
        tool === "mirror" ? "Ange spegelaxelns första punkt" : "Ange baspunkt",
      target:
        tool === "rotate"
          ? "Ange riktning/vinkel i grader · R: referens"
          : tool === "scale"
            ? "Ange skalfaktor, t.ex. 2 · R: referens"
            : tool === "mirror"
              ? "Ange spegelaxelns andra punkt · originalet behålls"
              : "Ange målpunkt eller skriv avstånd i mm",
      distance:
        tool === "fillet"
          ? "Ange radie i mm (0 ger skarpt hörn)"
          : tool === "chamfer"
            ? "Ange fasavstånd i mm"
            : "Ange offsetavstånd i mm",
      cut:
        tool === "trim"
          ? "Klicka på delen som ska bort · fortsätt klicka · Esc avslutar"
          : "Klicka nära änden som ska förlängas · fortsätt klicka · Esc avslutar",
      corner: editOperation.first
        ? "Välj andra linjen på sidan som ska behållas"
        : "Välj första linjen på sidan som ska behållas",
      vertex:
        tool === "pinsert"
          ? "Klicka för att lägga till hörn"
          : "Klicka på hörnet som ska tas bort",
      refOld:
        tool === "rotate"
          ? "Referens: ange gammal vinkel eller välj första riktpunkten"
          : "Referens: ange gammal längd i mm eller välj första mätpunkten",
      refPick2: "Referens: välj andra mätpunkten",
      refTarget:
        tool === "rotate"
          ? "Ange ny vinkel eller välj ny riktning från baspunkten"
          : "Ange ny längd i mm eller välj målpunkt från baspunkten",
      side: "Klicka på önskad sida · Esc avslutar",
    }[editOperation.phase];
  const next = `${(activeGrip ? "Grepp: välj ny punkt · längd/radie i mm eller @x,y · Esc avbryter" : null) || editPrompt || steps[tool]?.[points.length] || "Välj punkt"} · ${scaleText}`;
  if ($("prompt").textContent !== next) {
    $("prompt").textContent = next;
  }
}
function svg(tag, attrs, parent = $("overlay")) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  parent.append(n);
  return n;
}
function drawEntity(e, preview = false, parent = $("overlay")) {
  const g = svg(
    "g",
    {
      "data-id": e.id || "",
      class: "entity",
      opacity: (e.opacity ?? 1) * (preview ? 0.55 : 1),
    },
    parent,
  );
  const isSelected =
    parent === $("overlay") &&
    !preview &&
    (selection.has(e.id) || editOperation?.ids.includes(e.id));
  if (e.type === "freehand") {
    const attrs = {
      points: e.points.map((p) => `${p.x},${p.y}`).join(" "),
      fill: "none",
      stroke: isSelected ? "#2879c4" : e.color,
      "stroke-width": e.width,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    };
    svg("polyline", attrs, g);
    if (!preview)
      svg(
        "polyline",
        {
          ...attrs,
          stroke: "transparent",
          "stroke-width": Math.max(e.width, 10 / zoom),
          "pointer-events": "stroke",
        },
        g,
      );
    return;
  }
  if (e.type === "viewport") {
    const r = box(...e.points);
    svg(
      "rect",
      {
        x: r.x,
        y: r.y,
        width: r.w,
        height: r.h,
        fill: "none",
        stroke: isSelected ? "#147b60" : "#759a88",
        "stroke-width": 1 / zoom,
        "stroke-dasharray": `${5 / zoom} ${4 / zoom}`,
      },
      g,
    );
    svg(
      "rect",
      {
        x: r.x,
        y: r.y,
        width: r.w,
        height: r.h,
        fill: "none",
        stroke: "transparent",
        "stroke-width": 10 / zoom,
        "pointer-events": "stroke",
      },
      g,
    );
    if (e.showLabel) {
      const caption = viewportCaption(e);
      const text = svg(
        "text",
        {
          x: caption.p.x,
          y: caption.p.y,
          fill: "#263b35",
          "font-size": caption.size,
          "font-family": "Helvetica, Arial, sans-serif",
        },
        g,
      );
      text.textContent = caption.value;
    }
  }
  if (e.type === "block") {
    const a = e.points[0];
    const group = svg(
      "g",
      { transform: `translate(${a.x} ${a.y}) rotate(${e.rotation})` },
      g,
    );
    svg(
      "image",
      {
        href: e.preview,
        x: 0,
        y: 0,
        width: e.blockWidth,
        height: e.blockHeight,
        "pointer-events": "all",
      },
      group,
    );
    if (isSelected)
      svg(
        "rect",
        {
          x: 0,
          y: 0,
          width: e.blockWidth,
          height: e.blockHeight,
          fill: "none",
          stroke: "#147b60",
          "stroke-width": 1 / zoom,
        },
        group,
      );
  }
  for (const s of primitives(
    e,
    entityScale(e, state.entities, state.scales) || 1,
  )) {
    if (s.kind === "line") {
      svg(
        "line",
        {
          x1: s.a.x,
          y1: s.a.y,
          x2: s.b.x,
          y2: s.b.y,
          stroke: isSelected ? "#2879c4" : e.color,
          "stroke-width": e.width,
          "stroke-linecap": "round",
        },
        g,
      );
      if (!preview)
        svg(
          "line",
          {
            x1: s.a.x,
            y1: s.a.y,
            x2: s.b.x,
            y2: s.b.y,
            stroke: "transparent",
            "stroke-width": Math.max(e.width, 10 / zoom),
            "pointer-events": "stroke",
          },
          g,
        );
    }
    if (s.kind === "fill")
      svg(
        "rect",
        {
          x: s.rect.x,
          y: s.rect.y,
          width: s.rect.w,
          height: s.rect.h,
          fill: s.color || "white",
        },
        g,
      );
    if (s.kind === "text") {
      const n = svg(
        "text",
        {
          x: s.p.x,
          y: s.p.y,
          fill: e.color,
          "font-size": s.size,
          "font-family": "Helvetica, Arial, sans-serif",
        },
        g,
      );
      s.value.split("\n").forEach((l, i) => {
        const t = svg("tspan", { x: s.p.x, dy: i ? s.size * 1.25 : 0 }, n);
        t.textContent = l;
      });
    }
  }
  if (isSelected && (!editOperation || editOperation.phase === "select"))
    (e.type === "block" ? [e.points[0], blockCorners(e)[2]] : e.points).forEach(
      (p, i) =>
        svg(
          "rect",
          {
            x: p.x - 3.5 / zoom,
            y: p.y - 3.5 / zoom,
            width: 7 / zoom,
            height: 7 / zoom,
            fill: "#fff",
            stroke: "#147b60",
            "stroke-width": 1 / zoom,
            "data-grip": i,
            "data-id": e.id,
          },
          g,
        ),
    );
}
function style() {
  return {
    opacity:
      1 -
      Math.min(100, Math.max(0, Number($("transparency").value) || 0)) / 100,
    color: $("color").value,
    width: Math.min(20, Math.max(0.2, Number($("width").value) || 1.2)),
    fontSize: Math.min(96, Math.max(4, Number($("fontSize").value) || 12)),
  };
}
function paint() {
  if (!viewport) return;
  $("overlay").replaceChildren();
  if (drag?.kind === "freehand") drawEntity(drag.entity, true);
  if (tool === "eraseText" && hover) {
    const hit = textTargetAt(removableTextTargets, hover);
    if (hit)
      svg("polygon", {
        points: hit.polygon.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "#d5444426",
        stroke: "#d54444",
        "stroke-width": 1 / zoom,
        "pointer-events": "none",
      });
  }
  if (["extract", "coverLine", "eraseLine"].includes(tool) && hover) {
    const segment = pdfLineAt(hover);
    if (segment)
      svg("line", {
        x1: segment.a.x,
        y1: segment.a.y,
        x2: segment.b.x,
        y2: segment.b.y,
        stroke: "#e4a22d",
        "stroke-width": 4 / zoom,
        "pointer-events": "none",
      });
  }

  for (const e of pageEntities()
    .filter((e) => e.type !== "pdfErase")
    .sort((a, b) => (a.type !== "viewport") - (b.type !== "viewport")))
    try {
      drawEntity(
        activeGrip?.id === e.id && hover
          ? moveGrip(e, activeGrip.index, hover)
          : e,
      );
    } catch {}
  if (
    editOperation &&
    hover &&
    ["target", "side"].includes(editOperation.phase)
  ) {
    try {
      for (const e of editedEntities(hover)) drawEntity(e, true);
    } catch {}
  }
  if (tool === "block" && pendingBlock && hover)
    drawEntity({ ...pendingBlock, points: [hover] }, true);
  if (points.length && hover) {
    const ps = [...points, hover];
    if (tool === "calibrate")
      drawEntity({ type: "line", points: ps, ...style() }, true);
    else if (ps.length === counts[tool] && tool !== "text")
      try {
        drawEntity(
          {
            type: tool,
            page: pageNo,
            viewportId: scaleContext(ps[0]).owner?.id,
            points: ps,
            text: tool === "leader" ? "Kommentar" : "",
            ...style(),
            ...(tool === "mask" ? { color: "#ffffff" } : {}),
          },
          true,
        );
      } catch {}
    else
      svg("polyline", {
        points: ps.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "none",
        stroke: "#147b60",
        "stroke-width": 1 / zoom,
        "stroke-dasharray": `${4 / zoom} ${4 / zoom}`,
      });
  }
  if (tool !== "select") {
    for (const guide of aidGuides)
      svg("line", {
        x1: guide.a.x,
        y1: guide.a.y,
        x2: guide.b.x,
        y2: guide.b.y,
        stroke: guide.polar ? "#398b61" : "#5592a4",
        "stroke-width": 1 / zoom,
        "stroke-dasharray": `${6 / zoom} ${4 / zoom}`,
        "pointer-events": "none",
      });
    if (otrack)
      for (const p of trackingAnchors)
        svg("path", {
          d: `M ${p.x - 3 / zoom} ${p.y} h ${6 / zoom} M ${p.x} ${p.y - 3 / zoom} v ${6 / zoom}`,
          stroke: "#5592a4",
          "stroke-width": 1 / zoom,
          "pointer-events": "none",
        });
  }
  if (snapHit && hover && tool !== "select") {
    const p = snapHit.point,
      r = 4 / zoom,
      attrs = {
        fill: "white",
        stroke: "#c48b24",
        "stroke-width": 1.5 / zoom,
        "pointer-events": "none",
      };
    if (snapHit.kind === "Centrum")
      svg("circle", { cx: p.x, cy: p.y, r, ...attrs });
    else svg("path", { d: snapSymbol(snapHit.kind, p.x, p.y, r), ...attrs });
  }
  if (hover && tool !== "select") {
    svg("path", {
      d: `M ${hover.x - 6 / zoom} ${hover.y} h ${12 / zoom} M ${hover.x} ${hover.y - 6 / zoom} v ${12 / zoom}`,
      stroke: "#167d60",
      "stroke-width": 1 / zoom,
      "pointer-events": "none",
    });
  }
  if (drag?.kind === "selection") {
    const r = box(drag.start, drag.end),
      crossing = drag.end.x < drag.start.x;
    svg("rect", {
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      fill: crossing ? "#36a777" : "#408cdc",
      "fill-opacity": 0.12,
      stroke: crossing ? "#218654" : "#2879c4",
      "stroke-width": 1 / zoom,
      "stroke-dasharray": crossing ? `${5 / zoom} ${3 / zoom}` : "none",
      "pointer-events": "none",
      "data-selection-window": crossing ? "crossing" : "window",
    });
  }
}
function refresh() {
  quickToolBar?.updateActive();
  $("toolname").textContent =
    selection.size > 1
      ? `${selection.size} objekt`
      : names[current()?.type || tool];
  const activeType = current()?.type || tool;
  const hasStyle =
    activeType !== "viewport" &&
    activeType !== "block" &&
    activeType !== "select" &&
    activeType !== "calibrate" &&
    !(activeType === "mask" && !current()) &&
    !["extract", "coverLine", "eraseLine", "eraseText"].includes(activeType);
  $("viewportControls").hidden = current()?.type !== "viewport";
  if (current()?.type === "viewport") {
    $("viewportScale").value = current().denominator;
    $("viewportName").value = current().name || "Viewport";
    $("viewportLabel").checked = !!current().showLabel;
  }
  $("blockControls").hidden = current()?.type !== "block";
  if (current()?.type === "block") {
    $("blockSize").value = (
      (current().blockWidth / current().naturalWidth) *
      100
    ).toFixed(1);
    $("blockRotation").value = current().rotation;
  }
  $("styleControls").hidden = !hasStyle;
  $("transparencyControl").hidden = !(
    hasStyle ||
    ["viewport", "block", "mask"].includes(activeType) ||
    selection.size > 1
  );
  $("transparencyValue").value = `${$("transparency").value} %`;

  $("selectionHint").hidden =
    hasStyle || ["block", "viewport"].includes(current()?.type);
  $("selectionHint").textContent =
    selection.size > 1
      ? "Högerklick: gruppera · Ctrl/⌘-klick: välj enskilt objekt"
      : activeType === "coverLine"
        ? "Täckning med vitt · originalet finns kvar"
        : activeType === "eraseText"
          ? "Tar bort den rödmarkerade texten ur PDF-innehållet"
          : activeType === "eraseLine"
            ? "Tar bort fristående raka streck ur PDF-innehållet"
            : activeType === "extract"
              ? "Hämta en kopia · originalet finns kvar"
              : activeType === "calibrate"
                ? "Välj två punkter med känt avstånd"
                : activeType === "mask"
                  ? "Vit täckning · originalinnehållet finns kvar"
                  : "Välj ett verktyg eller ett objekt i ritningen";
  $("lineControl").querySelector("span").textContent =
    activeType === "freehand" ? "px" : "pt";
  $("width").setAttribute(
    "aria-label",
    activeType === "freehand"
      ? "Pennbredd i px vid 100 % zoom"
      : "Linjebredd i pt",
  );
  $("lineControl").hidden = ["text", "replace", "mask"].includes(activeType);
  $("textControl").hidden = !["text", "replace", "leader", "dim"].includes(
    activeType,
  );
  $("editText").hidden =
    !current() || !["text", "leader", "replace"].includes(activeType);
  $("delete").hidden = !selection.size;
  $("replace").classList.toggle("active", tool === "replace");
  prompt();
  paint();
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  $("undo").disabled = !undoStack.length;
  $("redo").disabled = !redoStack.length;
  $("delete").disabled = !selection.size;
  $("editText").disabled =
    !current() || !["text", "leader", "replace"].includes(current().type);
  for (const [id, on, label] of [
    ["polar", polar, "POLAR · F10"],
    ["otrack", otrack, "OTRACK · F11"],
  ]) {
    $(id).textContent = `${label} · ${on ? "PÅ" : "AV"}`;
    $(id).classList.toggle("active", on);
    $(id).setAttribute("aria-pressed", String(on));
  }
  $("ortho").textContent = `ORTHO ${ortho ? "PÅ" : "AV"} · F8`;
  $("ortho").classList.toggle("active", ortho);
  $("snap").classList.toggle("active", snap);
  $("snap").textContent = `SNAPP ${snap ? "PÅ" : "AV"}`;
  const scale = state.scales[pageNo];
  $("scaleLabel").textContent = scale ? "Skala kalibrerad" : "Ej kalibrerad";
  $("calibrate").textContent = scale ? "Ändra skala" : "Kalibrera";
}
function select(id, individual = false) {
  activeGrip = null;
  selection.clear();
  if (id)
    (individual ? [id] : expandGroups(state.entities, [id])).forEach((id) =>
      selection.add(id),
    );
  selected = selection.size === 1 ? id : null;
  const e = current();
  if (e) {
    $("toolname").textContent = names[e.type];
    for (const key of ["color", "width", "fontSize"]) $(key).value = e[key];
    $("transparency").value = Math.round((1 - (e.opacity ?? 1)) * 100);
  }
  refresh();
}
function displayedPage() {
  return pageRotation(
    viewport.width,
    viewport.height,
    state.rotations?.[pageNo] || 0,
  );
}
const documentScroll = createDocumentScroll($("viewport"), {
  changed: () => {
    if (!busy) view();
  },
  onError: error,
  drawAnnotations: (page, overlay) => {
    for (const entity of state.entities
      .filter((e) => e.page === page && e.type !== "pdfErase")
      .sort((a, b) => (a.type !== "viewport") - (b.type !== "viewport")))
      drawEntity(entity, false, overlay);
  },
  getPreviewPage: async (n) => {
    if (!state.entities.some((e) => e.type === "pdfErase" && e.page === n))
      return { page: await pdf.getPage(n) };
    const edited = await loadPdf(
      await applyLineRemovals(bytes, state.entities),
    );
    try {
      return { page: await edited.getPage(n), release: () => edited.destroy() };
    } catch (e) {
      await edited.destroy();
      throw e;
    }
  },
});
function scrollMetrics() {
  return viewport
    ? documentScrollMetrics(
        documentScroll.getLayout(),
        pageNo,
        pan,
        zoom,
        $("viewport").clientWidth,
        $("viewport").clientHeight,
      )
    : null;
}
const scrollbars = setupScrollbars({
  horizontal: $("horizontalScrollbar"),
  vertical: $("verticalScrollbar"),
  getMetrics: scrollMetrics,
  canScroll: () =>
    !!viewport &&
    (!busy || scrollLoading) &&
    !pendingDialog &&
    !drag &&
    !points.length &&
    !editOperation &&
    !activeGrip,
  scrollTo: scrollToPosition,
});
function view() {
  if (!viewport) return;
  const rotated = displayedPage();
  $("sheet").style.transform =
    `translate(${pan.x}px,${pan.y}px) scale(${zoom}) matrix(${rotated.matrix.join(",")})`;
  $("zoom").textContent = `${Math.round(zoom * 100)}%`;
  const corners = [
    { x: -pan.x / zoom, y: -pan.y / zoom },
    {
      x: ($("viewport").clientWidth - pan.x) / zoom,
      y: ($("viewport").clientHeight - pan.y) / zoom,
    },
  ].map(rotated.inverse);
  const left = Math.min(...corners.map((p) => p.x)),
    top = Math.min(...corners.map((p) => p.y));
  pdfDetail.update({
    width: viewport.width,
    height: viewport.height,
    zoom,
    pan: { x: -left * zoom, y: -top * zoom },
    screenWidth: Math.abs(corners[1].x - corners[0].x) * zoom,
    screenHeight: Math.abs(corners[1].y - corners[0].y) * zoom,
    dpr: window.devicePixelRatio || 1,
  });
  paint();
  documentScroll.update({
    pdf,
    page: pageNo,
    pan,
    zoom,
    rotations: state.rotations,
    revision: state,
  });
  scrollbars.update();
}
function fit() {
  if (!viewport) return;
  const dimensions = displayedPage();
  zoom = Math.min(
    ($("viewport").clientWidth - 70) / dimensions.width,
    ($("viewport").clientHeight - 55) / dimensions.height,
  );
  pan = {
    x: ($("viewport").clientWidth - dimensions.width * zoom) / 2,
    y: ($("viewport").clientHeight - dimensions.height * zoom) / 2,
  };
  view();
}
function fitAll() {
  if (!viewport) return;
  let left = 0,
    top = 0,
    right = viewport.width,
    bottom = viewport.height;
  for (const node of $("overlay").querySelectorAll("g.entity[data-id]")) {
    if (!node.dataset.id) continue;
    const r = node.getBBox();
    const entity = state.entities.find((e) => e.id === node.dataset.id);
    const margin = Math.max(4, (entity?.width || 0) / 2);
    left = Math.min(left, r.x - margin);
    top = Math.min(top, r.y - margin);
    right = Math.max(right, r.x + r.width + margin);
    bottom = Math.max(bottom, r.y + r.height + margin);
  }
  const rotatedBounds = [
    { x: left, y: top },
    { x: right, y: bottom },
  ].map(displayedPage().forward);
  left = Math.min(...rotatedBounds.map((p) => p.x));
  right = Math.max(...rotatedBounds.map((p) => p.x));
  top = Math.min(...rotatedBounds.map((p) => p.y));
  bottom = Math.max(...rotatedBounds.map((p) => p.y));
  const w = $("viewport").clientWidth,
    h = $("viewport").clientHeight;
  zoom = Math.min((w - 70) / (right - left), (h - 55) / (bottom - top));
  pan = {
    x: (w - (right - left) * zoom) / 2 - left * zoom,
    y: (h - (bottom - top) * zoom) / 2 - top * zoom,
  };
  view();
}
function zoomAt(
  f,
  x = $("viewport").clientWidth / 2,
  y = $("viewport").clientHeight / 2,
) {
  const next = Math.min(8, Math.max(0.1, zoom * f)),
    r = next / zoom;
  pan = { x: x - (x - pan.x) * r, y: y - (y - pan.y) * r };
  zoom = next;
  view();
}
async function showPage(n, keepView = false, scrollPan = null) {
  objectMenu?.close();
  if (
    !pdf ||
    pendingDialog ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > pdf.numPages
  )
    return;
  if (drag?.kind === "entity") state = drag.before;
  drag = null;
  activeGrip = null;
  clearTracking();
  if (editOperation) tool = "select";
  editOperation = null;
  const token = ++epoch;
  busy = true;
  pdfSegments = [];
  snapHit = null;
  textItems = [];
  removableTextTargets = [];
  pageNo = n;
  points = [];
  selected = null;
  selection.clear();
  hover = null;
  let editedPdf;
  const previous = renderTask;
  previous?.cancel();
  try {
    await pdfDetail.clear();
    if (previous) await previous.promise.catch(() => {});
    if (token !== epoch) return;
    if (state.entities.some((e) => e.type === "pdfErase"))
      editedPdf = await loadPdf(await applyLineRemovals(bytes, state.entities));
    const page = await (editedPdf || pdf).getPage(n);
    if (token !== epoch) return;
    viewport = page.getViewport({ scale: 1 });
    if (!page._liraSegments)
      page._liraSegments = extractSegments(
        await page.getOperatorList(),
        OPS,
        viewport.transform,
      );
    if (token !== epoch) return;
    pdfSegments = page._liraSegments;
    const renderScale = Math.min(
      2,
      Math.sqrt(16000000 / (viewport.width * viewport.height)),
      8192 / Math.max(viewport.width, viewport.height),
    );
    const res = page.getViewport({ scale: renderScale }),
      canvas = $("pdfcanvas");
    canvas.width = res.width;
    canvas.height = res.height;
    $("sheet").style.width = `${viewport.width}px`;
    $("sheet").style.height = `${viewport.height}px`;
    $("overlay").setAttribute(
      "viewBox",
      `0 0 ${viewport.width} ${viewport.height}`,
    );
    renderTask = page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: res,
    });
    await renderTask.promise;
    if (token !== epoch) return;
    const content = await page.getTextContent();
    if (token !== epoch) return;
    textItems = content.items;
    removableTextTargets = await textRemovalTargets(
      bytes,
      n,
      textItems,
      viewport,
    );
    if (token !== epoch) return;
    removableTextTargets = removableTextTargets.filter(
      (t) =>
        !state.entities.some(
          (e) =>
            e.type === "pdfErase" &&
            e.page === n &&
            e.eraseTextOffset === t.offset,
        ),
    );
    $("pageLabel").textContent = `Sida ${n} av ${pdf.numPages}`;
    $("pageNumber").value = n;
    $("pageNumber").max = pdf.numPages;
    $("pageTotal").textContent = `av ${pdf.numPages}`;
    $("prevPage").disabled = n === 1;
    $("nextPage").disabled = n === pdf.numPages;
    const detailSource = editedPdf;
    pdfDetail.setPage(page, detailSource ? () => detailSource.destroy() : null);
    editedPdf = null;
    if (scrollPan) pan = scrollPan;
    if (keepView) view();
    else fit();
    refresh();
  } catch (e) {
    if (e.name !== "RenderingCancelledException") error(e);
  } finally {
    await editedPdf?.destroy();
    if (token === epoch) {
      busy = false;
      view();
      library.refresh();
      autosave();
    }
  }
}
function stashDocument() {
  const d = documents.find((d) => d.id === activeId);
  if (!d) return;
  Object.assign(d, {
    state: drag?.kind === "entity" ? drag.before : state,
    undoStack,
    redoStack,
    pageNo,
  });
}
const documentTabsUI = documentTabs({
  getDocuments: () => documents,
  getActiveId: () => activeId,
  isChanged: (d) =>
    documentChanged(
      d.id === activeId
        ? drag?.kind === "entity"
          ? drag.before
          : state
        : d.state,
      d.savedState,
    ),
  activate: activateDocument,
  close: (id) => closeDocument(id).catch(error),
  reorder: (id, targetId, after) => {
    const next = reorderDocuments(documents, id, targetId, after);
    if (next === documents) return;
    documents.splice(0, documents.length, ...next);
    documentTabsUI.render({ revealActive: false });
    autosave();
  },
});
function renderDocuments() {
  documentTabsUI.render();
}
async function activateDocument(id) {
  if (busy || pendingDialog) return;
  const d = documents.find((d) => d.id === id);
  if (!d) return;
  const targetPage = d.pageNo;
  if (drag?.kind === "entity") state = drag.before;
  drag = null;
  activeGrip = null;
  stashDocument();
  activeId = id;
  pdf = d.pdf;
  bytes = d.bytes;
  name = d.name;
  state = d.state;
  undoStack = d.undoStack;
  redoStack = d.redoStack;
  tool = "select";
  $("filename").textContent = name;
  $("sheet").hidden = false;
  $("emptyWorkspace").hidden = true;
  $("pageNumber").disabled = false;
  renderDocuments();
  await showPage(targetPage);
}
async function openDocument(data, filename, project = null, fileHandle = null) {
  if (busy || pendingDialog) return;
  busy = true;
  $("saveStatus").textContent = "Öppnar …";
  try {
    if (!project) {
      const editable = await readEditablePdf(data);
      if (editable) {
        data = editable.bytes;
        project = editable.state;
      }
    }
    const instance = await loadPdf(data);
    if (project?.entities.some((e) => e.page > instance.numPages)) {
      await instance.destroy();
      throw Error("Projektets objekt hänvisar till sidor som saknas.");
    }
    const d = {
      id: crypto.randomUUID(),
      pdf: instance,
      bytes: data.slice(),
      name: filename,
      fileHandle,
      state: project
        ? {
            entities: clone(project.entities),
            scales: clone(project.scales),
            rotations: clone(project.rotations || {}),
          }
        : { entities: [], scales: {} },
      undoStack: [],
      redoStack: [],
      pageNo: 1,
    };
    d.savedState = documentSnapshot(d.state);
    documents.push(d);
    busy = false;
    await activateDocument(d.id);
  } finally {
    busy = false;
  }
}
async function saveDocument(d, saveAs = false) {
  if (
    busy ||
    pendingDialog ||
    drag ||
    points.length ||
    editOperation ||
    activeGrip
  ) {
    toast("Avsluta eller avbryt pågående kommando före sparande.");
    return false;
  }
  busy = true;
  $("save").disabled = $("saveAs").disabled = true;
  const snapshot = clone(d.state);
  try {
    // Request file access while this save still has the user's activation.
    const handle = await choosePdfTarget(d.fileHandle, d.name, saveAs);
    $("saveStatus").textContent = "Sparar PDF …";
    const result = await saveEditablePdf(d.bytes, snapshot, d.pdf);
    if (handle) await writePdfFile(handle, result);
    else download(result, "application/pdf", pdfFilename(d.name));
    d.fileHandle = handle;
    d.name = handle?.name || pdfFilename(d.name);
    if (d.id === activeId) {
      name = d.name;
      $("filename").textContent = name;
    }
    d.savedState = documentSnapshot(snapshot);
    renderDocuments();
    autosave();
    toast(
      handle
        ? "PDF sparad."
        : "PDF hämtad. Den innehåller dina redigerbara markeringar.",
    );
    return true;
  } catch (e) {
    if (e.name !== "AbortError") error(e);
    $("saveStatus").textContent =
      e.name === "AbortError" ? "Sparande avbrutet" : "Sparande misslyckades";
    return false;
  } finally {
    busy = false;
    $("save").disabled = $("saveAs").disabled = false;
  }
}
function emptyWorkspace() {
  documentScroll.clear();
  pdfDetail.clear().catch(error);
  editOperation = null;
  ++epoch;
  activeId = pdf = bytes = viewport = null;
  scrollbars.update();
  state = { entities: [], scales: {} };
  undoStack = [];
  redoStack = [];
  points = [];
  pdfSegments = [];
  textItems = [];
  removableTextTargets = [];
  selected = hover = snapHit = drag = null;
  selection.clear();
  tool = "select";
  pageNo = 0;
  $("sheet").hidden = true;
  $("overlay").replaceChildren();
  $("emptyWorkspace").hidden = false;
  $("filename").textContent = "Inget dokument";
  $("pageLabel").textContent = "Inget dokument";
  $("pageNumber").value = 0;
  $("pageTotal").textContent = "/ 0";
  for (const id of ["prevPage", "nextPage", "pageNumber"])
    $(id).disabled = true;
  renderDocuments();
  refresh();
}
async function closeDocument(id) {
  if (
    busy ||
    pendingDialog ||
    $("closeDocumentDialog").open ||
    $("export").disabled
  )
    return;
  stashDocument();
  const index = documents.findIndex((d) => d.id === id);
  if (index < 0) return;
  const d = documents[index];
  if (documentChanged(d.state, d.savedState)) {
    $("closeDocumentName").textContent = d.name;
    const dialog = $("closeDocumentDialog");
    dialog.returnValue = "cancel";
    const choice = await new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue), {
        once: true,
      });
      dialog.showModal();
    });
    if (choice !== "save" && choice !== "discard") return;
    if (choice === "save" && !(await saveDocument(d))) return;
  }
  documents.splice(index, 1);
  if (activeId === id) {
    if (documents.length)
      await activateDocument(
        documents[Math.min(index, documents.length - 1)].id,
      );
    else emptyWorkspace();
  } else renderDocuments();
  autosave();
  await d.pdf.destroy();
}
$("emptyOpen").onclick = () => $("open").click();
function pdfLineAt(point) {
  const covered = pageEntities().some((e) => {
    if (!["mask", "replace"].includes(e.type) || (e.opacity ?? 1) < 1)
      return false;
    const r = box(...e.points);
    return (
      point.x >= r.x &&
      point.x <= r.x + r.w &&
      point.y >= r.y &&
      point.y <= r.y + r.h
    );
  });
  return covered ? null : nearestSegment(point, pdfSegments, 8 / zoom);
}
function localPoint(ev, constrained = true) {
  if (tool === "freehand") constrained = false;
  const r = $("viewport").getBoundingClientRect();
  let p = {
    x: (ev.clientX - r.left - pan.x) / zoom,
    y: (ev.clientY - r.top - pan.y) / zoom,
  };
  p = displayedPage().inverse(p);
  const drawing =
    constrained &&
    tool !== "select" &&
    ![
      "mask",
      "replace",
      "extract",
      "coverLine",
      "eraseLine",
      "eraseText",
      "viewport",
    ].includes(tool) &&
    !space;
  const rawPointer = { ...p };
  aidGuides = [];
  snapHit = null;
  if (
    constrained &&
    snap &&
    !["mask", "replace", "extract", "eraseText"].includes(tool)
  ) {
    const raw = { ...p };
    let best = 9 / zoom;
    for (const e of pageEntities().filter(
      (e) =>
        !drag?.ids?.includes(e.id) &&
        e.id !== drag?.id &&
        e.id !== activeGrip?.id &&
        e.type !== "pdfErase",
    ))
      for (const [index, q] of e.points.entries()) {
        const d = distance(raw, q);
        if (d < best) {
          best = d;
          p = { ...q };
          snapHit = {
            point: p,
            kind:
              e.type === "circle" && index === 0
                ? "Centrum"
                : e.type === "line" || e.type === "leader"
                  ? "Ändpunkt"
                  : "Objekt",
          };
        }
      }
    const ownSegments = pageEntities()
      .filter(
        (e) =>
          !drag?.ids?.includes(e.id) &&
          e.id !== drag?.id &&
          e.id !== activeGrip?.id &&
          ["line", "rect", "leader", "polyline"].includes(e.type),
      )
      .flatMap((e) =>
        primitives(e, 1)
          .filter((p) => p.kind === "line")
          .map((p) => ({ a: p.a, b: p.b })),
      );
    const ownHit = nearestSnap(raw, ownSegments, best);
    if (ownHit) {
      p = ownHit.point;
      snapHit = ownHit;
    }
    if (!snapHit) {
      const hit = nearestSnap(raw, pdfSegments, 9 / zoom);
      if (hit) {
        const covered = pageEntities()
          .filter(
            (e) =>
              ["mask", "replace"].includes(e.type) && (e.opacity ?? 1) === 1,
          )
          .some((e) => {
            const r = box(...e.points);
            return (
              hit.point.x >= r.x &&
              hit.point.x <= r.x + r.w &&
              hit.point.y >= r.y &&
              hit.point.y <= r.y + r.h
            );
          });
        if (!covered) {
          p = hit.point;
          snapHit = hit;
        }
      }
    }
  }
  if (drawing && otrack && snap) {
    trackingAnchors = tracker.update(snapHit, performance.now());
    clearTimeout(trackTimer);
    if (snapHit && snapHit.kind !== "Linje") {
      const heldHit = snapHit;
      trackTimer = setTimeout(() => {
        if (!otrack || !snap || tool === "select") return;
        trackingAnchors = tracker.update(heldHit, performance.now());
        paint();
      }, 470);
    }
  }
  if (drawing && !snapHit) {
    const origin = points.at(-1);
    if (
      origin &&
      ortho &&
      ["line", "leader", "dim", "move", "copy"].includes(tool)
    )
      p = constrain(origin, rawPointer, true);
    else {
      const polarHit =
        origin &&
        polar &&
        ["line", "leader", "dim", "circle", "move", "copy"].includes(tool)
          ? polarPoint(origin, rawPointer, polarAngle)
          : null;
      if (polarHit) {
        p = polarHit.point;
        aidGuides = [
          {
            a: origin,
            b: {
              x: p.x + (Math.cos(polarHit.angle) * 40) / zoom,
              y: p.y + (Math.sin(polarHit.angle) * 40) / zoom,
            },
            polar: true,
          },
        ];
      } else if (otrack && snap) {
        const tracked = trackingPoint(rawPointer, trackingAnchors, 8 / zoom);
        if (tracked) {
          p = tracked.point;
          aidGuides = tracked.guides;
        }
      }
    }
  }
  return p;
}
async function addPoint(p) {
  if (tool === "freehand") {
    toast("Håll ned och dra i ritningen för att rita på fri hand.");
    return;
  }
  if (busy || pendingDialog || !viewport) return;
  if (tool === "dim" && !points.length && !scaleContext(p).scale) {
    toast(
      "Kalibrera pappret eller välj en startpunkt i en viewport innan du måttsätter.",
    );
    return;
  }
  points.push(p);
  if (points.length < counts[tool]) {
    refresh();
    return;
  }
  clearTracking();
  const type = tool,
    ps = clone(points);
  points = [];
  try {
    if (type === "viewport") {
      const r = box(...ps);
      if (r.w < 1 || r.h < 1)
        throw Error("Viewporten måste ha bredd och höjd.");
      const answer = await ask(
        "Viewportskala",
        "Ange nämnaren: 100 betyder skala 1:100. Papprets skala gäller utanför rutan.",
        "100",
        true,
      );
      if (answer === null) return;
      const denominator = Number(answer);
      if (
        !Number.isFinite(denominator) ||
        denominator < 1 ||
        denominator > 100000
      )
        throw Error("Ange en skala mellan 1:1 och 1:100000.");
      const e = {
        id: crypto.randomUUID(),
        type,
        page: pageNo,
        points: [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
        ],
        denominator,
        name: `Vy ${state.entities.filter((e) => e.type === "viewport").length + 1}`,
        showLabel: true,
        ...style(),
      };
      const next = clone(state);
      next.entities.push(e);
      commit(next);
      setTool("select");
      select(e.id);
      return;
    }
    if (type === "calibrate") {
      const d = distance(...ps);
      if (d < 0.01) throw Error("Välj två olika punkter.");
      const value = await ask(
        "Kalibrera skala",
        "Ange det verkliga avståndet mellan punkterna i millimeter.",
        "6000",
        true,
      );
      if (value === null) return;
      const mm = Number(value);
      if (!Number.isFinite(mm) || mm <= 0)
        throw Error("Avståndet måste vara större än noll.");
      const next = clone(state);
      next.scales[pageNo] = mm / d;
      commit(next);
      setTool("dim");
      return;
    }
    let text = "",
      replacementStyle = null;
    if (type === "arc") arcPoints(...ps);
    if (type === "dim") dimension(...ps);
    if (
      ["line", "circle", "rect", "replace", "mask"].includes(type) &&
      distance(...ps) < 0.1
    )
      throw Error("Objektet är för litet.");
    if (["text", "leader", "replace"].includes(type)) {
      let initial = "";
      if (type === "replace") {
        const r = box(...ps);
        const hits = textItems
          .filter((t) => t.str?.trim())
          .map((t) => {
            const [x, y] = viewport.convertToViewportPoint(
              t.transform[4],
              t.transform[5],
            );
            const h = Math.max(1, t.height);
            const [ex, ey] = viewport.convertToViewportPoint(
              t.transform[4] + t.width,
              t.transform[5] + h,
            );
            return {
              t,
              x: Math.min(x, ex),
              y: Math.min(y, ey),
              w: Math.abs(ex - x),
              h: Math.abs(ey - y),
              baseline: { x, y },
            };
          })
          .filter(
            (t) =>
              t.x < r.x + r.w &&
              t.x + t.w > r.x &&
              t.y < r.y + r.h &&
              t.y + t.h > r.y,
          );
        if (hits.length) {
          initial = hits
            .map(({ t }) => t.str + (t.hasEOL ? "\n" : " "))
            .join("")
            .trim();
          const left = Math.min(...hits.map((t) => t.x)) - 1,
            top = Math.min(...hits.map((t) => t.y)) - 1,
            right = Math.max(...hits.map((t) => t.x + t.w)) + 1,
            bottom = Math.max(...hits.map((t) => t.y + t.h)) + 2;
          ps[0] = { x: left, y: top };
          ps[1] = { x: right, y: bottom };
          replacementStyle = {
            color: "#263d43",
            fontSize: Math.max(4, hits[0].t.height),
            textAnchor: hits[0].baseline,
          };
        }
      }
      text = await ask(
        type === "replace" ? "Täck och ersätt PDF-text" : "Text",
        type === "replace"
          ? "En vit yta täcker området. Originaltexten finns kvar i PDF:en. Kontrollera att ritningslinjer inte täcks."
          : "Skriv texten. Radbrytningar bevaras.",
        initial,
      );
      if (text === null || !text.trim()) return;
    }
    const e = {
      id: crypto.randomUUID(),
      type,
      page: pageNo,
      points: ps,
      text,
      ...style(),
      ...(type === "mask" ? { color: "#ffffff" } : {}),
      ...(replacementStyle || {}),
      ...(["line", "circle", "rect", "arc", "text", "leader", "dim"].includes(
        type,
      )
        ? { viewportId: scaleContext(ps[0]).owner?.id }
        : {}),
    };
    const next = clone(state);
    next.entities.push(e);
    commit(next);
    if (type === "line") points = [ps[1]];
  } catch (e) {
    if (type === "line") points = [ps[0]];
    error(e);
  } finally {
    refresh();
  }
}
$("viewport").addEventListener("pointerdown", async (ev) => {
  if (ev.target.closest(".page-navigation")) return;
  if (!viewport || pendingDialog || busy) return;
  if (drag?.kind === "freehand") return;
  if (ev.button === 1 || space) {
    if (space) spacePanned = true;
    ev.preventDefault();
    drag = {
      kind: "pan",
      start: { x: ev.clientX, y: ev.clientY },
      pan: { ...pan },
    };
    $("viewport").setPointerCapture(ev.pointerId);
    return;
  }
  if (ev.button !== 0) return;
  const neighbouringPage = ev.target.closest(".document-page-preview");
  if (neighbouringPage) {
    const layout = documentScroll.getLayout();
    const target = layout[Number(neighbouringPage.dataset.page) - 1];
    const anchor = layout[pageNo - 1];
    if (target && anchor)
      await showPage(target.page, true, {
        x: pan.x + ((anchor.width - target.width) * zoom) / 2,
        y: pan.y + (target.top - anchor.top) * zoom,
      });
    return;
  }
  const p = localPoint(ev);
  if (tool === "freehand") {
    ev.preventDefault();
    drag = {
      kind: "freehand",
      pointerId: ev.pointerId,
      entity: {
        id: crypto.randomUUID(),
        type: "freehand",
        page: pageNo,
        points: [p],
        ...style(),
        viewportId: scaleContext(p).owner?.id,
      },
    };
    $("viewport").setPointerCapture(ev.pointerId);
    paint();
    return;
  }
  if (activeGrip) {
    try {
      applyGrip(p);
    } catch (e) {
      error(e);
    }
    return;
  }

  if (tool === "block" && pendingBlock) {
    const entity = {
      ...clone(pendingBlock),
      id: crypto.randomUUID(),
      page: pageNo,
      viewportId: scaleContext(p).owner?.id,
      points: [p],
    };
    const next = clone(state);
    next.entities.push(entity);
    commit(next);
    setTool("select");
    select(entity.id);
    return;
  }
  if (tool === "eraseText") {
    const hit = textTargetAt(removableTextTargets, p);
    if (!hit) {
      toast(
        "Ingen borttagbar text här. Text i bilder, block eller med sammansatt kodning stöds ännu inte. Använd Maska vid behov.",
      );
      return;
    }
    const next = clone(state);
    next.entities.push({
      id: crypto.randomUUID(),
      type: "pdfErase",
      page: pageNo,
      points: [hit.polygon[0], hit.polygon[2]],
      ...style(),
      eraseTextOffset: hit.offset,
    });
    commit(next);
    toast("PDF-texten har tagits bort. Ångra återställer den.");
    return;
  }
  if (["coverLine", "eraseLine"].includes(tool)) {
    const segment = pdfLineAt(p);
    if (!segment) {
      toast("Ingen rak PDF-linje här.");
      return;
    }
    const e = {
      id: crypto.randomUUID(),
      page: pageNo,
      points: [{ ...segment.a }, { ...segment.b }],
      ...style(),
    };
    if (tool === "coverLine") {
      e.type = "line";
      e.color = "#ffffff";
      e.width = 4;
      const next = clone(state);
      next.entities.push(e);
      commit(next);
      setTool("select");
      select(e.id);
      toast(
        "Linjen är täckt med vitt. Justera linjebredden vid behov. Originalet finns kvar.",
      );
    } else {
      busy = true;
      try {
        const hit = await findRemovableLine(bytes, pageNo, segment, viewport);
        if (
          !hit ||
          state.entities.some(
            (x) =>
              x.type === "pdfErase" &&
              x.page === pageNo &&
              x.eraseOffset === hit.offset,
          )
        ) {
          toast(
            "Den här linjen ingår i en sammansatt figur, ett block eller en bild. Använd Täck linje för visuell täckning.",
          );
          return;
        }
        e.type = "pdfErase";
        e.eraseOffset = hit.offset;
        const next = clone(state);
        next.entities.push(e);
        busy = false;
        commit(next);
        toast("PDF-linjen har tagits bort. Ångra återställer den.");
      } catch (err) {
        error(err);
      } finally {
        if (!renderTask || !state.entities.some((x) => x.id === e.id))
          busy = false;
      }
    }
    return;
  }
  if (tool === "extract") {
    const segment = pdfLineAt(p);
    if (!segment) {
      toast("Ingen rak PDF-linje här. Skannade bilder kan inte hämtas.");
      return;
    }
    const entity = {
      id: crypto.randomUUID(),
      type: "line",
      page: pageNo,
      points: [{ ...segment.a }, { ...segment.b }],
      ...style(),
    };
    const next = clone(state);
    next.entities.push(entity);
    commit(next);
    setTool("select");
    select(entity.id);
    toast(
      "Linjen är kopierad och kan redigeras. Originalet finns kvar i PDF-underlaget.",
    );
    return;
  }
  if (
    (tool === "select" || editOperation?.phase === "select") &&
    !ev.target.closest("[data-id]")
  ) {
    drag = {
      kind: "selection",
      start: localPoint(ev, false),
      end: localPoint(ev, false),
      before: [...(editOperation?.ids || selection)],
      edit: !!editOperation,
      individual: ev.ctrlKey || ev.metaKey,
      mode: ev.altKey
        ? "remove"
        : ev.shiftKey || editOperation
          ? "add"
          : "replace",
    };
    $("viewport").setPointerCapture(ev.pointerId);
    paint();
    return;
  }
  if (editOperation) {
    if (editOperation.phase === "select") {
      const id = ev.target.closest("[data-id]")?.dataset.id;
      const e = state.entities.find((e) => e.id === id);
      if (!e || !editTypes(tool).includes(e.type)) {
        toast(
          tool === "offset"
            ? "Välj en ritad linje, cirkel eller rektangel."
            : "Välj ett ritat objekt. Använd Hämta linje för PDF-underlaget.",
        );
        return;
      }
      const members = (
        ev.ctrlKey || ev.metaKey || ["pinsert", "pdelete"].includes(tool)
          ? [id]
          : expandGroups(state.entities, [id])
      ).filter((id) =>
        editTypes(tool).includes(state.entities.find((e) => e.id === id)?.type),
      );
      const i = editOperation.ids.indexOf(id);
      if (i < 0) {
        if (["pinsert", "pdelete"].includes(tool)) editOperation.ids = [];
        editOperation.ids.push(
          ...members.filter((id) => !editOperation.ids.includes(id)),
        );
      } else
        editOperation.ids = editOperation.ids.filter(
          (id) => !members.includes(id),
        );
      refresh();
    } else if (["cut", "corner", "vertex"].includes(editOperation.phase)) {
      try {
        advancedPick(p, ev.target.closest("[data-id]")?.dataset.id);
      } catch (e) {
        error(e);
      }
    } else editPoint(p);
    return;
  }
  if (tool === "select") {
    const id = ev.target.closest("[data-id]")?.dataset.id;
    if (id) {
      if (ev.ctrlKey || ev.metaKey) select(id, true);
      else if (ev.shiftKey || ev.altKey) {
        const members = expandGroups(state.entities, [id]);
        const remove = ev.altKey || members.every((id) => selection.has(id));
        for (const member of members)
          remove ? selection.delete(member) : selection.add(member);
        selected = selection.size === 1 ? [...selection][0] : null;
        if (selected) select(selected, true);
        refresh();
        return;
      } else if (
        !selection.has(id) ||
        !expandGroups(state.entities, [id]).every((id) => selection.has(id))
      )
        select(id);
      drag = {
        kind: "entity",
        ids: [...selection],
        start: p,
        before: clone(state),
        id,
        grip:
          selection.size === 1 && ev.target.hasAttribute("data-grip")
            ? Number(ev.target.getAttribute("data-grip"))
            : null,
        moved: false,
      };
      $("viewport").setPointerCapture(ev.pointerId);
    } else select(null);
  } else if (["replace", "mask"].includes(tool)) {
    points = [p];
    drag = { kind: "area" };
    $("viewport").setPointerCapture(ev.pointerId);
  } else addPoint(p);
});
$("viewport").addEventListener("pointerleave", () => {
  clearTimeout(trackTimer);
  if (otrack) trackingAnchors = tracker.update(null, performance.now());
});
$("viewport").addEventListener("pointermove", (ev) => {
  if (!viewport) return;
  const p = localPoint(ev, drag?.kind !== "selection");
  $("coords").textContent = `X ${p.x.toFixed(0)} · Y ${p.y.toFixed(0)}`;
  if (drag?.kind === "freehand") {
    if (ev.pointerId !== drag.pointerId) return;
    // Some browsers deliver a released move before pointerup, or lose capture.
    if (ev.buttons === 0) {
      finishDrag(ev);
      return;
    }
    const samples = ev.getCoalescedEvents?.();
    for (const event of samples?.length ? samples : [ev])
      appendStrokePoint(
        drag.entity.points,
        localPoint(event, false),
        0.5 / zoom,
      );
    paint();
    return;
  }
  if (drag?.kind === "selection") {
    drag.end = p;
    paint();
    return;
  }
  if (drag?.kind === "pan") {
    pan = {
      x: drag.pan.x + ev.clientX - drag.start.x,
      y: drag.pan.y + ev.clientY - drag.start.y,
    };
    view();
    return;
  }
  if (drag?.kind === "entity") {
    const delta = { x: p.x - drag.start.x, y: p.y - drag.start.y };
    if (distance(p, drag.start) > 2 / zoom) drag.moved = true;
    if (drag.ids?.length > 1) {
      const ids = new Set(drag.ids);
      for (const e of drag.before.entities)
        if (ids.has(e.viewportId)) ids.add(e.id);
      for (const e of drag.before.entities.filter((e) => ids.has(e.id)))
        state.entities[state.entities.findIndex((x) => x.id === e.id)] =
          translateEntity(e, drag.start, p);
      paint();
      return;
    }
    const original = drag.before.entities.find((e) => e.id === drag.id),
      e = current();
    if (!e) return;
    if (original.textAnchor && drag.grip === null)
      e.textAnchor = {
        x: original.textAnchor.x + delta.x,
        y: original.textAnchor.y + delta.y,
      };
    if (e.type === "block" && drag.grip === 1) {
      const a = original.points[0],
        corner = blockCorners(original)[2];
      const dx = corner.x - a.x,
        dy = corner.y - a.y;
      const factor = Math.max(
        0.01,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
      );
      e.blockWidth = original.blockWidth * factor;
      e.blockHeight = original.blockHeight * factor;
      paint();
      return;
    }
    if (drag.grip !== null && ["line", "circle", "arc"].includes(e.type)) {
      try {
        const q = original.points[drag.grip];
        Object.assign(
          e,
          moveGrip(original, drag.grip, { x: q.x + delta.x, y: q.y + delta.y }),
        );
      } catch {
        Object.assign(e, clone(original));
      }
      paint();
      return;
    }
    e.points = original.points.map((q, i) =>
      drag.grip === null || drag.grip === i
        ? { x: q.x + delta.x, y: q.y + delta.y }
        : { ...q },
    );
    if (e.type === "viewport" && drag.grip === null) {
      for (const child of drag.before.entities.filter(
        (x) => x.viewportId === e.id,
      )) {
        const index = state.entities.findIndex((x) => x.id === child.id);
        state.entities[index] = clone(child);
      }
      transformChildren(state, e.id, { x: 0, y: 0 }, 1, delta);
    }
    paint();
    return;
  }
  hover = p;
  prompt();
  paint();
});
function finishDrag(ev, cancel = false, useFinalPoint = true) {
  if (!drag) return;
  if (drag.kind === "freehand" && ev.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;
  if (d.kind === "freehand") {
    if (!cancel) {
      if (
        completeStroke(
          d.entity.points,
          useFinalPoint ? localPoint(ev, false) : null,
        )
      ) {
        const next = clone(state);
        next.entities.push(d.entity);
        commit(next);
      }
    }
    if ($("viewport").hasPointerCapture(ev.pointerId))
      $("viewport").releasePointerCapture(ev.pointerId);
    paint();
    return;
  }
  if (d.kind === "selection") {
    if (!cancel) {
      const end = localPoint(ev, false);
      const hits =
        distance(d.start, end) > 3 / zoom
          ? pageEntities()
              .filter((e) => {
                const group = [
                  ...$("overlay").querySelectorAll("g.entity"),
                ].find((g) => g.dataset.id === e.id);
                const texts = group
                  ? [...group.querySelectorAll("text")].map((t) => {
                      const b = t.getBBox();
                      return { x: b.x, y: b.y, w: b.width, h: b.height };
                    })
                  : [];
                return inSelection(
                  e,
                  d.start,
                  end,
                  entityScale(e, state.entities, state.scales) || 1,
                  texts,
                );
              })
              .map((e) => e.id)
          : [];
      let ids = mergeSelection(
        d.before,
        d.individual ? hits : expandGroups(state.entities, hits),
        d.mode,
      );
      if (d.edit) {
        ids = ids.filter((id) =>
          editTypes(tool).includes(
            state.entities.find((e) => e.id === id)?.type,
          ),
        );
        if (["pinsert", "pdelete"].includes(tool)) ids = ids.slice(-1);
        editOperation.ids = ids;
      } else {
        selection.clear();
        ids.forEach((id) => selection.add(id));
        selected = ids.length === 1 ? ids[0] : null;
        if (selected) select(selected, true);
      }
    }
    refresh();
  }
  if (d.kind === "area") {
    if (cancel) {
      points = [];
      paint();
    } else addPoint(localPoint(ev));
  }
  if (d.kind === "entity") {
    const next = clone(state);
    state = d.before;
    if (!cancel && d.moved) {
      try {
        const e = next.entities.find((e) => e.id === d.id);
        if (
          e.type === "viewport" &&
          (box(...e.points).w < 1 || box(...e.points).h < 1)
        )
          throw Error("Viewporten måste ha bredd och höjd.");
        primitives(e, entityScale(e, next.entities, next.scales) || 1);
        commit(next);
      } catch (e) {
        error(e);
        refresh();
      }
    } else {
      if (
        !cancel &&
        d.grip !== null &&
        ["line", "circle", "arc"].includes(current()?.type)
      )
        activeGrip = { id: d.id, index: d.grip };
      hover = null;
      refresh();
    }
  }
  if ($("viewport").hasPointerCapture(ev.pointerId))
    $("viewport").releasePointerCapture(ev.pointerId);
}
$("viewport").addEventListener("pointerup", (ev) => finishDrag(ev));
// Also catch release outside the drawing area if native capture was interrupted.
document.addEventListener(
  "pointerup",
  (ev) => {
    if (drag?.kind === "freehand") finishDrag(ev);
  },
  true,
);
$("viewport").addEventListener("pointercancel", (ev) => finishDrag(ev, true));
$("viewport").addEventListener("lostpointercapture", (ev) => {
  if (drag?.kind === "freehand") finishDrag(ev, false, false);
});
let scrollLoading = false;
let queuedScroll = { x: 0, y: 0 };
let queuedScrollbarPosition = {};
function scrollToPosition(position) {
  if (scrollLoading) {
    queuedScrollbarPosition = { ...queuedScrollbarPosition, ...position };
    queuedScroll = { x: 0, y: 0 };
    return;
  }
  const metrics = scrollMetrics();
  if (!metrics) return;
  const delta = (axis) =>
    position[axis] === undefined
      ? 0
      : position[axis] * metrics[axis].range - metrics[axis].offset;
  scrollDocument(delta("x"), delta("y"));
}
async function scrollDocument(dx, dy) {
  if (scrollLoading) {
    queuedScroll.x += dx;
    queuedScroll.y += dy;
    return;
  }
  const layout = documentScroll.getLayout();
  if (!layout.length) {
    pan = { x: pan.x - dx, y: pan.y - dy };
    view();
    return;
  }
  const position = scrollPosition(
    layout,
    pageNo,
    pan,
    zoom,
    dx,
    dy,
    $("viewport").clientHeight,
  );
  pan = position.currentPan;
  view();
  if (position.page === pageNo) return;
  scrollLoading = true;
  try {
    await showPage(position.page, true, position.pan);
  } finally {
    scrollLoading = false;
    const queued = queuedScroll;
    queuedScroll = { x: 0, y: 0 };
    const position = queuedScrollbarPosition;
    queuedScrollbarPosition = {};
    if (Object.keys(position).length) scrollToPosition(position);
    else if (queued.x || queued.y) scrollDocument(queued.x, queued.y);
  }
}
$("viewport").addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    if (!viewport || (busy && !scrollLoading) || pendingDialog || drag) return;
    const r = $("viewport").getBoundingClientRect();
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? r.height : 1;
    if (ev.ctrlKey) {
      if (busy) return;
      zoomAt(
        Math.exp(-ev.deltaY * unit * 0.0015),
        ev.clientX - r.left,
        ev.clientY - r.top,
      );
      return;
    }
    if (points.length || editOperation || activeGrip) return;
    const dx = (ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX) * unit;
    const dy = (ev.shiftKey ? 0 : ev.deltaY) * unit;
    scrollDocument(dx, dy);
  },
  { passive: false },
);
async function editText() {
  const e = current();
  if (!e || !["text", "leader", "replace"].includes(e.type)) return;
  const value = await ask(
    "Redigera text",
    "Ändra texten för det valda objektet.",
    e.text,
  );
  if (value !== null && value.trim()) {
    const next = clone(state);
    next.entities.find((n) => n.id === e.id).text = value;
    commit(next);
  }
}
$("overlay").addEventListener("dblclick", () => {
  if (tool === "select") editText();
});
function remove() {
  if (!selection.size) return;
  const ids = new Set(selection),
    next = clone(state);
  next.entities = next.entities.filter(
    (e) => !ids.has(e.id) && !ids.has(e.viewportId),
  );
  selected = null;
  selection.clear();
  commit(next);
}

$("transparency").oninput = () => {
  $("transparencyValue").value = `${$("transparency").value} %`;
  // Preview on the SVG; commit once on release so one drag is one undo step.
  const opacity = style().opacity;
  for (const node of $("overlay").querySelectorAll("g.entity[data-id]"))
    if (selection.has(node.dataset.id)) node.setAttribute("opacity", opacity);
};
$("transparency").onchange = () => {
  const opacity = style().opacity;
  $("transparency").value = Math.round((1 - opacity) * 100);
  if (selection.size) {
    const next = clone(state);
    for (const e of next.entities) if (selection.has(e.id)) e.opacity = opacity;
    commit(next);
  }
  refresh();
};
for (const key of ["color", "width", "fontSize"])
  $(key).onchange = () => {
    if (current()) {
      const next = clone(state);
      Object.assign(
        next.entities.find((e) => e.id === selected),
        style(),
      );
      commit(next);
    }
    refresh();
  };
const library = blockLibrary({
  canPlace: () => !!pdf && !busy,
  place: (block) => {
    pendingBlock = block;
    delete pendingBlock.libraryId;
    setTool("block");
  },
  rename: (name) => ask("Byt namn på block", "Namn i biblioteket", name),
  error,
});
$("saveLibraryBlock").onclick = async () => {
  const block = current();
  if (block?.type !== "block" || busy || pendingDialog) return;
  try {
    const name = await ask(
      "Spara i blockbibliotek",
      "Ange ett namn för blocket.",
      block.blockName || "PDF-block",
    );
    if (!name?.trim()) return;
    await library.add({ ...clone(block), blockName: name.trim() });
    toast("Blocket är sparat i biblioteket och kan användas i andra dokument.");
  } catch (e) {
    error(e);
  }
};
$("blockInput").onchange = async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file || busy || pendingDialog) return;
  let source, normalized;
  try {
    busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    source = await loadPdf(data);
    const answer =
      source.numPages > 1
        ? await ask(
            "Välj sida till PDF-block",
            `PDF:en har ${source.numPages} sidor. Ange sidnummer.`,
            "1",
            true,
          )
        : "1";
    if (answer === null) return;
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > source.numPages)
      throw Error("Sidnumret finns inte i PDF:en.");
    const block = await blockPage(data, n);
    normalized = await loadPdf(block.bytes);
    const page = await normalized.getPage(1);
    const vp = page.getViewport({
      scale: Math.min(3, 1600 / Math.max(block.width, block.height)),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: vp,
      background: "rgba(0,0,0,0)",
    }).promise;
    const scale = Math.min(
      1,
      ((viewport?.width || block.width * 2.5) * 0.4) / block.width,
      ((viewport?.height || block.height * 2.5) * 0.4) / block.height,
    );
    const importedBlock = {
      type: "block",
      blockPdf: base64(block.bytes),
      preview: canvas.toDataURL("image/png"),
      blockName:
        file.name.replace(/\.pdf$/i, "") +
        (source.numPages > 1 ? ` · sida ${n}` : ""),
      naturalWidth: block.width,
      naturalHeight: block.height,
      blockWidth: block.width * scale,
      blockHeight: block.height * scale,
      rotation: 0,
      ...style(),
    };
    await library.add(importedBlock);
    busy = false;
    await library.open();
    toast("Blocket är sparat i biblioteket.");
  } catch (e) {
    error(e);
  } finally {
    busy = false;
    await source?.destroy();
    await normalized?.destroy();
  }
};
for (const id of ["blockSize", "blockRotation"])
  $(id).onchange = () => {
    const e = current();
    if (e?.type !== "block") return;
    const value = Number($(id).value);
    if (
      !Number.isFinite(value) ||
      (id === "blockSize" && (value < 1 || value > 10000))
    ) {
      refresh();
      return;
    }
    const next = clone(state),
      block = next.entities.find((x) => x.id === e.id);
    if (id === "blockSize") {
      block.blockWidth = (block.naturalWidth * value) / 100;
      block.blockHeight = (block.naturalHeight * value) / 100;
    } else block.rotation = ((value % 360) + 360) % 360;
    commit(next);
  };
for (const id of ["viewportName", "viewportLabel"])
  $(id).onchange = () => {
    if (busy || pendingDialog || current()?.type !== "viewport") return;
    const next = clone(state),
      e = next.entities.find((e) => e.id === selected);
    e.name = $("viewportName").value.trim().slice(0, 100) || "Viewport";
    e.showLabel = $("viewportLabel").checked;
    commit(next);
  };
$("newPdf").onclick = () => {
  if (busy || pendingDialog) return;
  $("newPdfDialog").showModal();
};
$("newPdfForm").onsubmit = async (event) => {
  event.preventDefault();
  $("newPdfDialog").close();
  try {
    const data = await blankPdf(
      $("paperSize").value,
      $("paperOrientation").value === "landscape",
    );
    const filename =
      ($("newPdfName").value.trim() || "Ny ritning").replace(/\.pdf$/i, "") +
      ".pdf";
    await openDocument(data, filename, {
      entities: [],
      scales: { 1: mmPerPoint },
    });
  } catch (e) {
    error(e);
  }
};
$("cancelNewPdf").onclick = () => $("newPdfDialog").close();
$("viewportScale").onchange = () => {
  if (busy || pendingDialog || current()?.type !== "viewport") return;
  try {
    commit(
      changeViewportScale(state, selected, Number($("viewportScale").value)),
    );
  } catch (e) {
    error(e);
    refresh();
  }
};
$("copyBlock").onclick = () => {
  if (current()?.type !== "block") return;
  pendingBlock = clone(current());
  delete pendingBlock.id;
  delete pendingBlock.groupId;
  setTool("block");
};
$("open").onclick = async () => {
  if (busy || pendingDialog) return;
  if (!window.showOpenFilePicker) {
    $("pdfInput").click();
    return;
  }
  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: "PDF-dokument",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });
    for (const handle of handles) {
      const file = await handle.getFile();
      await openDocument(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
        null,
        handle,
      );
    }
  } catch (e) {
    if (e.name !== "AbortError") error(e);
  }
};
$("projectOpen").onclick = () => $("projectInput").click();
$("pdfInput").onchange = async (ev) => {
  for (const file of ev.target.files)
    try {
      await openDocument(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch (e) {
      error(e);
    }
  ev.target.value = "";
};
$("projectInput").onchange = async (ev) => {
  const file = ev.target.files[0];
  if (file)
    try {
      const p = validateProject(JSON.parse(await file.text()));
      await openDocument(
        Uint8Array.from(atob(p.pdf), (c) => c.charCodeAt(0)),
        p.name || "Ritning.pdf",
        p,
      );
    } catch (e) {
      error(e);
    }
  ev.target.value = "";
};
$("save").onclick = () => {
  stashDocument();
  const d = documents.find((d) => d.id === activeId);
  if (d) saveDocument(d);
};
$("saveAs").onclick = () => {
  stashDocument();
  const d = documents.find((d) => d.id === activeId);
  if (d) saveDocument(d, true);
};
$("export").onclick = async () => {
  if (!pdf || busy) return;
  $("export").disabled = true;
  try {
    const exportName = name;
    const result = await exportPdf(
      bytes,
      clone(state.entities),
      clone(state.scales),
      pdf,
      clone(state.rotations || {}),
    );
    download(
      result,
      "application/pdf",
      exportName.replace(/\.pdf$/i, "") + "-markerad.pdf",
    );
    toast(
      "Visningskopia exporterad. Använd Spara PDF för att behålla redigerbara markeringar.",
    );
  } catch (e) {
    error(e);
  } finally {
    $("export").disabled = false;
  }
};
$("demo").onclick = async () => {
  try {
    await openDocument(await demoPdf(), "Exempelritning.pdf");
  } catch (e) {
    error(e);
  }
};
$("fit").onclick = fit;
$("fitAll").onclick = fitAll;
$("zoomIn").onclick = () => zoomAt(1.2);
$("zoomOut").onclick = () => zoomAt(1 / 1.2);
$("undo").onclick = () => history();
$("redo").onclick = () => history(true);
$("delete").onclick = remove;
$("editText").onclick = editText;
$("calibrate").onclick = () => setTool("calibrate");
$("replace").onclick = () => setTool("replace");
$("ortho").onclick = () => {
  ortho = !ortho;
  if (ortho) polar = false;
  clearTracking();
  refresh();
};
$("snap").onclick = () => {
  snap = !snap;
  clearTracking();
  refresh();
};
$("polar").onclick = () => {
  polar = !polar;
  if (polar) ortho = false;
  clearTracking();
  refresh();
};
$("otrack").onclick = () => {
  otrack = !otrack;
  clearTracking();
  refresh();
  if (otrack)
    toast(
      "Håll pekaren över en snappunkt en kort stund. Följ sedan dess vågräta eller lodräta hjälplinje.",
    );
};
$("polarAngle").onchange = () => {
  polarAngle = Number($("polarAngle").value);
  clearTracking();
  refresh();
};
function finishSelection() {
  const es = editOperation.ids.map((id) =>
    state.entities.find((e) => e.id === id),
  );
  if (!es.length) throw Error("Välj minst ett objekt först.");
  const next = clone(state);
  next.entities = next.entities.filter(
    (e) => !editOperation.ids.includes(e.id),
  );
  if (tool === "join") next.entities.push(joinEntities(es));
  if (tool === "explode")
    for (const e of es)
      next.entities.push(
        ...explodeEntity(e).map((n) => ({ ...n, id: crypto.randomUUID() })),
      );
  commit(next);
  setTool("select");
}
function advancedPick(p, id) {
  const e = state.entities.find((e) => e.id === id),
    next = clone(state);
  if (editOperation.phase === "cut") {
    if (!e) throw Error("Klicka på en ritad linje.");
    const result = trimLine(
      e,
      state.entities.filter((x) => editOperation.ids.includes(x.id)),
      p,
      tool === "extend",
    );
    next.entities = next.entities.filter((x) => x.id !== id);
    const replacements = result.map((x, i) => ({
      ...x,
      id: i ? crypto.randomUUID() : id,
    }));
    next.entities.push(...replacements);
    if (editOperation.ids.includes(id))
      editOperation.ids = [
        ...editOperation.ids.filter((x) => x !== id),
        ...replacements.map((x) => x.id),
      ];
  } else if (editOperation.phase === "vertex") {
    const source = state.entities.find((e) => e.id === editOperation.ids[0]);
    const n = vertexEdit(source, p, tool === "pdelete");
    next.entities[next.entities.findIndex((e) => e.id === source.id)] = n;
  } else {
    if (!e || e.type !== "line") throw Error("Välj en rak linje.");
    if (!editOperation.first) {
      editOperation.first = { id, p };
      refresh();
      return;
    }
    const first = state.entities.find((x) => x.id === editOperation.first.id);
    if (first.viewportId !== e.viewportId)
      throw Error("Linjerna måste tillhöra samma viewport eller papper.");
    const scale = entityScale(e, state.entities, state.scales);
    if (!scale)
      throw Error("Kalibrera pappret eller använd en viewport först.");
    const result = cornerLines(
      first,
      e,
      editOperation.first.p,
      p,
      editOperation.amount / scale,
      tool === "fillet",
    );
    for (const n of result.updated)
      next.entities[next.entities.findIndex((x) => x.id === n.id)] = n;
    if (result.bridge)
      next.entities.push({ ...result.bridge, id: crypto.randomUUID() });
    editOperation.first = null;
  }
  commit(next);
  clearTracking();
  refresh();
}
function editedEntities(p) {
  return editOperation.ids.map((id) => {
    const e = state.entities.find((e) => e.id === id);
    if (tool === "offset") {
      const scale = entityScale(e, state.entities, state.scales);
      if (!scale)
        throw Error("Kalibrera pappret eller använd en viewport först.");
      return offsetEntity(e, editOperation.amount / scale, p);
    }
    if (["rotate", "scale", "mirror"].includes(tool))
      return transformEntity(e, tool, points[0], p, editOperation.value);
    return translateEntity(e, points[0], p);
  });
}
function operationScale() {
  const scales = editOperation.ids.map((id) =>
    entityScale(
      state.entities.find((e) => e.id === id),
      state.entities,
      state.scales,
    ),
  );
  if (!scales[0] || scales.some((s) => s !== scales[0]))
    throw Error("Exakt längd kräver objekt med samma kalibrerade skala.");
  return scales[0];
}
function editPoint(p) {
  if (editOperation.phase === "refOld") {
    editOperation.refPoint = p;
    editOperation.phase = "refPick2";
    refresh();
    return;
  }
  if (editOperation.phase === "refPick2") {
    if (distance(editOperation.refPoint, p) < 1e-8) {
      toast("Välj två olika referenspunkter.");
      return;
    }
    editOperation.reference =
      tool === "rotate"
        ? Math.atan2(
            p.y - editOperation.refPoint.y,
            p.x - editOperation.refPoint.x,
          )
        : distance(editOperation.refPoint, p);
    editOperation.phase = "refTarget";
    refresh();
    return;
  }
  if (editOperation.phase === "refTarget") {
    try {
      editOperation.value = referenceValue(
        tool,
        editOperation.reference,
        tool === "rotate"
          ? Math.atan2(p.y - points[0].y, p.x - points[0].x)
          : distance(points[0], p),
      );
      editOperation.phase = "target";
    } catch (e) {
      error(e);
      return;
    }
  }
  if (editOperation.phase === "base") {
    points = [p];
    editOperation.phase = "target";
    refresh();
    return;
  }
  if (!["target", "side"].includes(editOperation.phase)) return;
  if (tool === "scale" && editOperation.value === undefined) {
    toast("Skriv en skalfaktor i kommandoraden.");
    return;
  }
  try {
    const edits = editedEntities(p),
      next = clone(state);
    const copies = copyGroupIds(edits, () => crypto.randomUUID());
    for (const [index, e] of edits.entries()) {
      if (["move", "rotate", "scale"].includes(tool))
        next.entities[next.entities.findIndex((x) => x.id === e.id)] = e;
      else next.entities.push(copies[index]);
    }
    commit(next);
    if (["move", "rotate", "scale", "mirror"].includes(tool)) setTool("select");
    else {
      clearTracking();
      hover = null;
      refresh();
    }
  } catch (e) {
    error(e);
  }
}
function editCommand(value, number) {
  if (
    value.toUpperCase() === "R" &&
    ["rotate", "scale"].includes(tool) &&
    editOperation.phase === "target"
  ) {
    editOperation.phase = "refOld";
    delete editOperation.value;
    refresh();
    return;
  }
  if (
    ["refOld", "refTarget"].includes(editOperation.phase) &&
    value &&
    Number.isFinite(number)
  ) {
    try {
      const n =
        tool === "rotate"
          ? (-number * Math.PI) / 180
          : number / operationScale();
      if (tool === "scale" && n <= 0)
        throw Error("Längden måste vara positiv.");
      if (editOperation.phase === "refOld") {
        editOperation.reference = n;
        editOperation.phase = "refTarget";
      } else {
        editOperation.value = referenceValue(tool, editOperation.reference, n);
        editOperation.phase = "target";
        editPoint(hover || points[0]);
      }
    } catch (e) {
      error(e);
    }
    refresh();
    return;
  }
  if (editOperation.phase === "select") {
    if (["erase", "join", "explode"].includes(tool)) {
      try {
        finishSelection();
      } catch (e) {
        error(e);
      }
      return;
    }
    if (!editOperation.ids.length && ["trim", "extend"].includes(tool))
      editOperation.ids = pageEntities()
        .filter((e) => editTypes(tool).includes(e.type))
        .map((e) => e.id);
    if (!editOperation.ids.length) {
      toast("Välj minst ett objekt först.");
      return;
    }
    editOperation.phase = editPhase(tool);
  } else if (editOperation.phase === "distance") {
    if (
      (["fillet", "chamfer"].includes(tool)
        ? number < 0 || !value
        : !(number > 0)) ||
      !Number.isFinite(number)
    ) {
      toast("Ange ett positivt avstånd i mm.");
      return;
    }
    if (
      editOperation.ids.some(
        (id) =>
          !entityScale(
            state.entities.find((e) => e.id === id),
            state.entities,
            state.scales,
          ),
      )
    ) {
      toast("Kalibrera pappret eller använd en viewport först.");
      return;
    }
    editOperation.amount = number;
    editOperation.phase = ["fillet", "chamfer"].includes(tool)
      ? "corner"
      : "side";
  } else if (
    editOperation.phase === "target" &&
    ["rotate", "scale"].includes(tool) &&
    value &&
    Number.isFinite(number)
  ) {
    if (tool === "scale" && number <= 0) {
      toast("Ange en positiv skalfaktor.");
      return;
    }
    editOperation.value =
      tool === "rotate" ? (-number * Math.PI) / 180 : number;
    editPoint(hover || points[0]);
  } else if (
    editOperation.phase === "target" &&
    number > 0 &&
    hover &&
    ["move", "copy"].includes(tool)
  ) {
    const scales = editOperation.ids.map((id) =>
      entityScale(
        state.entities.find((e) => e.id === id),
        state.entities,
        state.scales,
      ),
    );
    if (!scales[0] || scales.some((s) => s !== scales[0])) {
      toast("Exakt avstånd kräver objekt med samma kalibrerade skala.");
      return;
    }
    editPoint(constrain(points[0], hover, false, number, scales[0]));
  } else if (!value) setTool("select");
  else toast("Ange en punkt i ritningen eller ett giltigt avstånd.");
  refresh();
}
const aliases = {
  FH: "freehand",
  FREEHAND: "freehand",
  RO: "rotate",
  ROTATE: "rotate",
  SC: "scale",
  SCALE: "scale",
  MI: "mirror",
  MIRROR: "mirror",
  E: "erase",
  ERASE: "erase",
  TR: "trim",
  TRIM: "trim",
  EX: "extend",
  EXTEND: "extend",
  J: "join",
  JOIN: "join",
  X: "explode",
  EXPLODE: "explode",
  F: "fillet",
  FILLET: "fillet",
  CHA: "chamfer",
  CHAMFER: "chamfer",
  PI: "pinsert",
  PINSERT: "pinsert",
  PD: "pdelete",
  PDELETE: "pdelete",
  M: "move",
  MOVE: "move",
  CO: "copy",
  COPY: "copy",
  O: "offset",
  OFFSET: "offset",
  L: "line",
  C: "circle",
  REC: "rect",
  A: "arc",
  T: "text",
  LE: "leader",
  VP: "viewport",
  DIM: "dim",
  CAL: "calibrate",
  TEXTEDIT: "replace",
  MASK: "mask",
  GETLINE: "extract",
  COVERLINE: "coverLine",
  ERASELINE: "eraseLine",
  ERASETEXT: "eraseText",
  V: "select",
};
function applyGrip(p) {
  const next = clone(state),
    index = next.entities.findIndex((e) => e.id === activeGrip.id);
  if (index < 0) {
    activeGrip = null;
    return;
  }
  next.entities[index] = moveGrip(next.entities[index], activeGrip.index, p);
  activeGrip = null;
  hover = null;
  commit(next);
  refresh();
}
function runCommand(value) {
  if (busy || pendingDialog || document.querySelector("dialog[open]")) return;
  value = value.trim();
  if (value) {
    const log = document.getElementById("lira-command-log");
    if (log) {
      const line = document.createElement("div");
      line.textContent = `› ${value}`;
      log.append(line);
      while (log.children.length > 30) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight;
    }
  }
  const number = Number(value.replace(",", "."));
  if (activeGrip) {
    if (!value) {
      activeGrip = null;
      hover = null;
      refresh();
      return;
    }
    try {
      const e = state.entities.find((e) => e.id === activeGrip.id);
      const scale = entityScale(e, state.entities, state.scales);
      const owner = state.entities.find((v) => v.id === e.viewportId);
      const r = owner
        ? box(...owner.points)
        : { x: 0, y: 0, h: viewport.height };
      const p = Number.isFinite(number)
        ? gripLengthPoint(e, activeGrip.index, number, scale, hover)
        : exactPoint(value, {
            base: e.points[activeGrip.index],
            origin: { x: r.x, y: r.y + r.h },
            scale,
          });
      if (!p) throw Error("Ange ett mått eller en koordinat för greppet.");
      applyGrip(p);
    } catch (e) {
      error(e);
    }
    return;
  }
  if (!value && !editOperation) {
    if (tool !== "select") setTool("select");
    else if (lastTool) setTool(lastTool);
    return;
  }
  const canPoint = editOperation
    ? (["base", "target", "refOld", "refPick2", "refTarget"].includes(
        editOperation.phase,
      ) &&
        !["scale", "rotate"].includes(tool)) ||
      ["base", "refOld", "refPick2"].includes(editOperation.phase)
    : [
        "line",
        "circle",
        "rect",
        "arc",
        "leader",
        "dim",
        "viewport",
        "text",
        "calibrate",
      ].includes(tool);
  if (
    canPoint &&
    (/^[@#]/.test(value) ||
      value.includes("<") ||
      value.includes(";") ||
      (!Number.isFinite(number) && value.includes(",")))
  ) {
    try {
      const base = points.at(-1),
        context = scaleContext(base || hover),
        r = context.owner
          ? box(...context.owner.points)
          : { x: 0, y: 0, h: viewport.height };
      const scale = editOperation && base ? operationScale() : context.scale;
      const p = exactPoint(value, {
        base,
        origin: { x: r.x, y: r.y + r.h },
        scale,
      });
      if (p) {
        if (editOperation) editPoint(p);
        else addPoint(p);
        return;
      }
    } catch (e) {
      error(e);
      return;
    }
  }
  if (
    editOperation &&
    (value === "" || Number.isFinite(number) || value.toUpperCase() === "R")
  )
    editCommand(value, number);
  else if (["HJÄLP", "HELP", "?"].includes(value.toUpperCase()))
    toast(
      "M: flytta · CO: kopiera · O: offset · RO: rotera · SC: skala · MI: spegla · TR: trimma · EX: förläng · E: radera · J: sammanfoga · X: dela upp · F: avrunda · CHA: fasa · PI/PD: hörn · L: linje · C: cirkel · REC: rektangel · A: båge · T: text · LE: leader · BLOCK: blockbibliotek · DIM: mått · CAL: kalibrera · VP: viewport · MASK: maska · TEXTEDIT: ersätt text · GETLINE: kopiera PDF-linje · COVERLINE: täck linje · ERASELINE: ta bort PDF-linje · ERASETEXT: ta bort PDF-text · U: ångra · Z: anpassa · ZE: visa allt · Esc: avbryt",
    );
  else if (value.toUpperCase() === "BLOCK") library.open();
  else if (aliases[value.toUpperCase()]) setTool(aliases[value.toUpperCase()]);
  else if (value.toUpperCase() === "U") history();
  else if (value.toUpperCase() === "Z") fit();
  else if (value.toUpperCase() === "ZE") fitAll();
  else if (
    number > 0 &&
    points.length &&
    hover &&
    ["line", "circle"].includes(tool)
  ) {
    const activeScale = scaleContext(points[0]).scale;
    if (!activeScale)
      toast(
        "Kalibrera pappret eller börja i en viewport för att ange längder i mm.",
      );
    else addPoint(constrain(points[0], hover, false, number, activeScale));
  } else toast("Okänt kommando. Skriv HJÄLP för att se alla kommandon.");
}
$("command").addEventListener("keydown", (ev) => {
  if (ev.isComposing || !["Enter", " "].includes(ev.key)) return;
  ev.preventDefault();
  ev.stopPropagation();
  const value = ev.target.value;
  ev.target.value = "";
  runCommand(value);
  ev.target.blur();
});
window.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    if (!document.querySelector("dialog[open]"))
      $(ev.shiftKey ? "saveAs" : "save").click();
    return;
  }
  if (document.querySelector(".quick-tools-dialog[open]")) return;
  if (
    $("documentPicker").open ||
    $("closeDocumentDialog").open ||
    $("blockLibrary").open
  )
    return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName);
  if (ev.key === "Escape") {
    activeGrip = null;
    $("fileMenu").open = false;
    clearTracking();
    if (pendingDialog || $("newPdfDialog").open) return;
    if (drag?.kind === "entity") state = drag.before;
    drag = null;
    points = [];
    hover = null;
    selected = null;
    selection.clear();
    tool = "select";
    editOperation = null;
    $("command").value = "";
    $("command").blur();
    refresh();
    return;
  }
  if (typing || pendingDialog || $("newPdfDialog").open) return;
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
    ev.preventDefault();
    history(ev.shiftKey);
    return;
  }
  if (
    (ev.key === "Enter" || ev.key === " ") &&
    ev.target.closest("button, summary, a")
  )
    return;
  if (ev.key === "Enter") {
    ev.preventDefault();
    runCommand("");
    return;
  }
  if (ev.key === "F8") {
    ev.preventDefault();
    $("ortho").click();
  }
  if (ev.key === "F10" || ev.key === "F11") {
    ev.preventDefault();
    $(ev.key === "F10" ? "polar" : "otrack").click();
    return;
  }
  if (ev.key === " ") {
    ev.preventDefault();
    if (!space) spacePanned = false;
    space = true;
  }
  if (ev.key === "Delete" || ev.key === "Backspace") {
    ev.preventDefault();
    remove();
  }
  if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && ev.key !== " ") {
    $("command").focus();
    $("command").value = ev.key;
    ev.preventDefault();
  }
});
window.addEventListener("keyup", (ev) => {
  if (ev.key === " ") {
    const repeat = space && !spacePanned;
    space = false;
    if (repeat && !/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName))
      runCommand("");
  }
});
window.addEventListener("blur", () => {
  space = false;
});
new ResizeObserver(() => {
  if (viewport) fit();
}).observe($("viewport"));
async function start() {
  try {
    let saved;
    try {
      saved = await readSaved();
    } catch {}
    if (saved?.version === 2 && Array.isArray(saved.documents)) {
      restoring = true;
      let wanted = null;
      for (const d of saved.documents) {
        await openDocument(d.bytes, d.name, d.state, d.fileHandle || null);
        const opened = documents.at(-1);
        opened.savedState =
          d.savedState ?? documentSnapshot({ entities: [], scales: {} });
        opened.pageNo = Math.max(
          1,
          Math.min(opened.pdf.numPages, d.pageNo || 1),
        );
        if (d.id === saved.activeId) wanted = opened.id;
      }
      if (documents.length) await activateDocument(wanted || documents[0].id);
      else emptyWorkspace();
      restoring = false;
      autosave();
    } else if (saved?.bytes) await openDocument(saved.bytes, saved.name, saved);
    else await openDocument(await demoPdf(), "Exempelritning.pdf");
  } catch (e) {
    error(e);
  } finally {
    restoring = false;
  }
}
const startup = start();
setupFileHandling({
  ready: startup,
  canOpen: () =>
    !busy &&
    !restoring &&
    !pendingDialog &&
    !drag &&
    !points.length &&
    !editOperation &&
    !activeGrip,
  open: (data, name, handle) => openDocument(data, name, null, handle),
  error,
  waiting: () =>
    toast(
      "En PDF väntar på att öppnas. Avsluta kommandot eller dialogen först.",
    ),
});

$("togglePages").onclick = () => {
  $("pagePanel").classList.toggle("documents-collapsed");
  $("togglePages").setAttribute(
    "aria-expanded",
    String(!$("pagePanel").classList.contains("documents-collapsed")),
  );
};
$("fileMenu").addEventListener("click", (event) => {
  if (event.target.closest("button")) $("fileMenu").open = false;
});
document.addEventListener("pointerdown", (event) => {
  if (!$("fileMenu").contains(event.target)) $("fileMenu").open = false;
});

$("prevPage").onclick = () => {
  if (!busy) showPage(pageNo - 1);
};
$("nextPage").onclick = () => {
  if (!busy) showPage(pageNo + 1);
};
$("pageNumber").onchange = () => {
  const n = Number($("pageNumber").value);
  if (pdf && !busy && Number.isInteger(n) && n >= 1 && n <= pdf.numPages)
    showPage(n);
  else $("pageNumber").value = pageNo;
};

initializeLiraShell();
quickToolBar = setupQuickTools({
  host: document.querySelector("main > .workspace"),
  tools: tools.filter(([id]) =>
    ["freehand", "line", "rect", "circle", "arc", "text", "leader"].includes(
      id,
    ),
  ),
  current: () => ({ tool, ...style() }),
  canUse: () => !!pdf && !busy && !pendingDialog,
  activate: (preset) => {
    setTool(preset.tool);
    $("color").value = preset.color;
    $("width").value = preset.width;
    $("fontSize").value = preset.fontSize;
    $("transparency").value = Math.round((1 - (preset.opacity ?? 1)) * 100);
    refresh();
  },
  error,
});

setupPWA(async () => {
  if (
    busy ||
    restoring ||
    pendingDialog ||
    drag ||
    points.length ||
    editOperation ||
    activeGrip ||
    document.querySelector("dialog[open]")
  )
    return "Avsluta eller avbryt pågående kommando före uppdatering.";
  clearTimeout(saveTimer);
  stashDocument();
  await writeSaved({
    version: 2,
    activeId,
    documents: documents.map((d) => ({
      id: d.id,
      name: d.name,
      bytes: d.bytes,
      state: clone(d.state),
      pageNo: d.pageNo,
      savedState: d.savedState,
      fileHandle: persistableFileHandle(d.fileHandle),
    })),
  });
});

function rotateCurrentPage(amount) {
  if (!pdf || !viewport || busy || pendingDialog) return;
  setTool("select");
  const next = clone(state);
  next.rotations ||= {};
  next.rotations[pageNo] = normalizeRotation(
    (next.rotations[pageNo] || 0) + amount,
  );
  commit(next);
  fit();
  toast(amount > 0 ? "Sidan roterad 90° medurs" : "Sidan roterad 90° moturs");
}
$("rotatePageCW").onclick = () => rotateCurrentPage(90);
$("rotatePageCCW").onclick = () => rotateCurrentPage(-90);

let contextObjectId = null;
function changeGrouping(ungroup = false) {
  if (busy || pendingDialog || !selection.size) return;
  const next = clone(state);
  try {
    next.entities = ungroup
      ? ungroupObjects(next.entities, [...selection])
      : groupObjects(next.entities, [...selection], crypto.randomUUID());
    if (!ungroup) {
      const members = expandGroups(next.entities, [...selection]);
      selection.clear();
      members.forEach((id) => selection.add(id));
      selected = null;
    }
    commit(next);
    toast(
      ungroup
        ? "Gruppen är upplöst."
        : "Objekten är grupperade. Ctrl/⌘-klick väljer ett enskilt objekt.",
    );
  } catch (e) {
    error(e);
  }
}
objectMenu = setupObjectMenu({
  host: $("viewport"),
  open: (event) => {
    if (
      !pdf ||
      busy ||
      pendingDialog ||
      drag ||
      document.querySelector("dialog[open]")
    )
      return null;
    const id = event.target.closest("[data-id]")?.dataset.id;
    const hit = state.entities.find(
      (e) => e.id === id && e.type !== "pdfErase",
    );
    contextObjectId = hit?.id || null;
    if (tool !== "select") setTool("select");
    if (hit && !selection.has(hit.id)) select(hit.id);
    if (!selection.size) return null;
    const chosen = state.entities.filter((e) => selection.has(e.id));
    const alreadyGrouped =
      chosen.length > 1 &&
      chosen.every((e) => e.groupId && e.groupId === chosen[0].groupId);
    return [
      {
        label: "Gruppera",
        action: "group",
        disabled: chosen.length < 2 || alreadyGrouped,
      },
      {
        label: "Lös upp grupp",
        action: "ungroup",
        disabled: !chosen.some((e) => e.groupId),
      },
      ...(hit?.groupId
        ? [{ label: "Välj enskilt objekt", action: "individual" }]
        : []),
    ];
  },
  actions: {
    group: () => changeGrouping(),
    ungroup: () => changeGrouping(true),
    individual: () => select(contextObjectId, true),
  },
});
