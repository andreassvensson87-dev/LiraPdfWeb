import "./style.css";
import { blankPdf } from "./blank-pdf.js";
import {
  polarPoint,
  trackingPoint,
  createTracker,
  snapSymbol,
} from "./drawing-aids.js";
const tracker = createTracker();
let polar = false,
  otrack = false,
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
import { documentTabs } from "./document-tabs.js";
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
  ["circle", "○", "Cirkel", "C"],
  ["rect", "▭", "Rektangel", "REC"],
  ["arc", "◜", "Båge", "A"],
  ["text", "T", "Text", "T"],
  ["leader", "↗", "Leader", "LE"],
  ["viewport", "", "Viewport", "VP"],
  ["dim", "↔", "Mått", "DIM"],
  ["mask", "▧", "Maska", "MASK"],
  ["extract", "", "Hämta linje", "GETLINE"],
  ["coverLine", "", "Täck linje", "COVERLINE"],
  ["eraseLine", "", "Ta bort PDF-linje", "ERASELINE"],
];
const toolCategories = {
  block: "create",
  line: "create",
  circle: "create",
  rect: "create",
  arc: "create",
  text: "create",
  leader: "create",
  mask: "edit",
  extract: "edit",
  coverLine: "edit",
  eraseLine: "edit",
  replace: "edit",
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
  $("replace").hidden = category !== "edit";
  $("measureCalibrate").hidden = category !== "measure";
}
for (const button of document.querySelectorAll("[data-category]")) {
  button.onclick = () => {
    if (busy || pendingDialog) return;
    setTool("select");
    showCategory(button.dataset.category);
  };
  button.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...document.querySelectorAll("[data-category]")];
    let i = buttons.indexOf(button);
    i =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 2
          : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    buttons[i].click();
    buttons[i].focus();
  };
}
const names = Object.fromEntries(tools.map((t) => [t[0], t[2]]));
Object.assign(names, { calibrate: "Kalibrera", replace: "Täck och ersätt" });
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
        })),
      });
      $("saveStatus").textContent = "Sparat i webbläsaren";
    } catch (e) {
      $("saveStatus").textContent = "Autosparande misslyckades";
      toast("Kunde inte autospara. Spara en projektfil.");
    }
  }, 350);
}
function removalKey(s) {
  return JSON.stringify(s.entities.filter((e) => e.type === "pdfErase"));
}
function commit(next) {
  const redraw = removalKey(state) !== removalKey(next);
  undoStack.push(clone(state));
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  state = next;
  refresh();
  autosave();
  if (redraw) showPage(pageNo, true);
}
function history(redo = false) {
  if (busy) return;
  const before = removalKey(state);
  const from = redo ? redoStack : undoStack,
    to = redo ? undoStack : redoStack;
  if (!from.length) return;
  clearTracking();
  to.push(clone(state));
  state = from.pop();
  if (before !== removalKey(state)) showPage(pageNo, true);
  selected = null;
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
  if (busy || !pdf) return;
  clearTracking();
  if (drag?.kind === "entity") state = drag.before;
  drag = null;
  tool = t;
  if (toolCategories[t]) showCategory(toolCategories[t]);
  points = [];
  hover = null;
  selected = null;
  $("toolname").textContent = names[t];
  refresh();
}
for (const [id, icon, label, shortcut] of tools) {
  const b = document.createElement("button");
  b.className = "tool";
  b.dataset.tool = id;
  b.title = `${label} (${shortcut})`;
  const paths = {
    block:
      '<rect x="4" y="3" width="13" height="17"/><path d="M9 12h12m-6-6v12"/>',
    viewport:
      '<rect x="3" y="4" width="18" height="16" stroke-dasharray="3 2"/><path d="M8 9h8v6H8Z"/>',
    select: '<path d="m5 3 14 9-7 1-3 7Z"/>',
    line: '<path d="M5 19 19 5"/><rect x="3" y="17" width="4" height="4"/><rect x="17" y="3" width="4" height="4"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    rect: '<rect x="3" y="5" width="18" height="14" rx="1"/>',
    arc: '<path d="M4 19A15 15 0 0 1 19 4"/><path d="M2 19h4M19 2v4"/>',
    text: '<path d="M5 5h14M12 5v15M8 20h8"/>',
    leader: '<path d="m3 20 9-12h9M3 14v6h6"/>',
    coverLine: '<path d="M4 18 18 4M7 21 21 7"/>',
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
    viewport: ["Välj viewportens första hörn", "Välj motsatt hörn"],
    block: ["Klicka för att placera PDF-block · Esc avslutar"],
    line: ["Välj startpunkt", "Välj slutpunkt eller skriv längd"],
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
    eraseLine: ["Klicka på en fristående rak PDF-linje för att ta bort den"],
    extract: ["Välj PDF-linje att kopiera · originalet finns kvar"],
    mask: ["Dra ett område att täcka · originalinnehållet finns kvar"],
    select: [
      "Välj objekt · mellanslag + dra: panorera · hjul: zooma · HJÄLP: kommandon",
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
  const next = `${steps[tool]?.[points.length] || "Välj punkt"} · ${scaleText}`;
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
function drawEntity(e, preview = false) {
  const g = svg("g", {
    "data-id": e.id || "",
    class: "entity",
    opacity: preview ? 0.55 : 1,
  });
  const isSelected = e.id === selected;
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
    const label = svg(
      "text",
      {
        x: r.x + 5 / zoom,
        y: r.y - 6 / zoom,
        fill: "#40775e",
        "font-size": 11 / zoom,
      },
      g,
    );
    label.textContent = `${e.name || "Viewport"} 1:${e.denominator || "…"}`;
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
          stroke: e.color,
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
  if (isSelected)
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
    color: $("color").value,
    width: Math.min(20, Math.max(0.2, Number($("width").value) || 1.2)),
    fontSize: Math.min(96, Math.max(4, Number($("fontSize").value) || 12)),
  };
}
function paint() {
  if (!viewport) return;
  $("overlay").replaceChildren();
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
      drawEntity(e);
    } catch {}
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
}
function refresh() {
  $("toolname").textContent = names[current()?.type || tool];
  const activeType = current()?.type || tool;
  const hasStyle =
    activeType !== "viewport" &&
    activeType !== "block" &&
    activeType !== "select" &&
    activeType !== "calibrate" &&
    !(activeType === "mask" && !current()) &&
    !["extract", "coverLine", "eraseLine"].includes(activeType);
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
  $("selectionHint").hidden =
    hasStyle || ["block", "viewport"].includes(current()?.type);
  $("selectionHint").textContent =
    activeType === "coverLine"
      ? "Täckning med vitt · originalet finns kvar"
      : activeType === "eraseLine"
        ? "Tar bort fristående raka streck ur PDF-innehållet"
        : activeType === "extract"
          ? "Hämta en kopia · originalet finns kvar"
          : activeType === "calibrate"
            ? "Välj två punkter med känt avstånd"
            : activeType === "mask"
              ? "Vit täckning · originalinnehållet finns kvar"
              : "Välj ett verktyg eller ett objekt i ritningen";
  $("lineControl").hidden = ["text", "replace", "mask"].includes(activeType);
  $("textControl").hidden = !["text", "replace", "leader", "dim"].includes(
    activeType,
  );
  $("editText").hidden =
    !current() || !["text", "leader", "replace"].includes(activeType);
  $("delete").hidden = !current();
  $("replace").classList.toggle("active", tool === "replace");
  prompt();
  paint();
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  $("undo").disabled = !undoStack.length;
  $("redo").disabled = !redoStack.length;
  $("delete").disabled = !current();
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
function select(id) {
  selected = id;
  const e = current();
  if (e) {
    $("toolname").textContent = names[e.type];
    for (const key of ["color", "width", "fontSize"]) $(key).value = e[key];
  }
  refresh();
}
function view() {
  if (!viewport) return;
  $("sheet").style.transform =
    `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  $("zoom").textContent = `${Math.round(zoom * 100)}%`;
  paint();
}
function fit() {
  if (!viewport) return;
  zoom = Math.min(
    ($("viewport").clientWidth - 70) / viewport.width,
    ($("viewport").clientHeight - 55) / viewport.height,
  );
  pan = {
    x: ($("viewport").clientWidth - viewport.width * zoom) / 2,
    y: ($("viewport").clientHeight - viewport.height * zoom) / 2,
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
async function showPage(n, keepView = false) {
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
  clearTracking();
  const token = ++epoch;
  busy = true;
  pdfSegments = [];
  snapHit = null;
  textItems = [];
  pageNo = n;
  points = [];
  selected = null;
  hover = null;
  let editedPdf;
  const previous = renderTask;
  previous?.cancel();
  try {
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
    $("pageLabel").textContent = `Sida ${n} av ${pdf.numPages}`;
    $("pageNumber").value = n;
    $("pageNumber").max = pdf.numPages;
    $("pageTotal").textContent = `av ${pdf.numPages}`;
    $("prevPage").disabled = n === 1;
    $("nextPage").disabled = n === pdf.numPages;
    if (keepView) view();
    else fit();
    refresh();
  } catch (e) {
    if (e.name !== "RenderingCancelledException") error(e);
  } finally {
    await editedPdf?.destroy();
    if (token === epoch) {
      busy = false;
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
  activate: activateDocument,
  close: (id) => closeDocument(id).catch(error),
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
async function openDocument(data, filename, project = null) {
  if (busy || pendingDialog) return;
  busy = true;
  $("saveStatus").textContent = "Öppnar …";
  try {
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
      state: project
        ? { entities: clone(project.entities), scales: clone(project.scales) }
        : { entities: [], scales: {} },
      undoStack: [],
      redoStack: [],
      pageNo: 1,
    };
    d.savedState = JSON.stringify(d.state);
    documents.push(d);
    busy = false;
    await activateDocument(d.id);
  } finally {
    busy = false;
  }
}
function saveDocument(d) {
  download(
    JSON.stringify({
      format: "lirapdf",
      version: 1,
      name: d.name,
      pdf: base64(d.bytes),
      ...clone(d.state),
    }),
    "application/json",
    d.name.replace(/\.pdf$/i, "") + ".lirapdf",
  );
  d.savedState = JSON.stringify(d.state);
  autosave();
}
function emptyWorkspace() {
  ++epoch;
  activeId = pdf = bytes = viewport = null;
  state = { entities: [], scales: {} };
  undoStack = [];
  redoStack = [];
  points = [];
  pdfSegments = [];
  textItems = [];
  selected = hover = snapHit = drag = null;
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
  if (JSON.stringify(d.state) !== d.savedState) {
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
    if (choice === "save") saveDocument(d);
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
$("emptyOpen").onclick = () => $("pdfInput").click();
function pdfLineAt(point) {
  const covered = pageEntities().some((e) => {
    if (!["mask", "replace"].includes(e.type)) return false;
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
  const r = $("viewport").getBoundingClientRect();
  let p = {
    x: (ev.clientX - r.left - pan.x) / zoom,
    y: (ev.clientY - r.top - pan.y) / zoom,
  };
  const drawing =
    constrained &&
    tool !== "select" &&
    ![
      "mask",
      "replace",
      "extract",
      "coverLine",
      "eraseLine",
      "viewport",
    ].includes(tool) &&
    !space;
  const rawPointer = { ...p };
  aidGuides = [];
  snapHit = null;
  if (constrained && snap && !["mask", "replace", "extract"].includes(tool)) {
    const raw = { ...p };
    let best = 9 / zoom;
    for (const e of pageEntities().filter(
      (e) => e.id !== drag?.id && e.type !== "pdfErase",
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
        (e) => e.id !== drag?.id && ["line", "rect", "leader"].includes(e.type),
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
          .filter((e) => ["mask", "replace"].includes(e.type))
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
    if (origin && ortho && ["line", "leader", "dim"].includes(tool))
      p = constrain(origin, rawPointer, true);
    else {
      const polarHit =
        origin && polar && ["line", "leader", "dim", "circle"].includes(tool)
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
  } catch (e) {
    error(e);
  } finally {
    refresh();
  }
}
$("viewport").addEventListener("pointerdown", async (ev) => {
  if (!viewport || pendingDialog || busy) return;
  if (ev.button === 1 || space) {
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
  const p = localPoint(ev);

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
  if (tool === "select") {
    const id = ev.target.closest("[data-id]")?.dataset.id;
    if (id) {
      select(id);
      drag = {
        kind: "entity",
        start: p,
        before: clone(state),
        id,
        grip: ev.target.hasAttribute("data-grip")
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
  const p = localPoint(ev);
  $("coords").textContent = `X ${p.x.toFixed(0)} · Y ${p.y.toFixed(0)}`;
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
function finishDrag(ev, cancel = false) {
  if (!drag) return;
  const d = drag;
  drag = null;
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
    } else refresh();
  }
  if ($("viewport").hasPointerCapture(ev.pointerId))
    $("viewport").releasePointerCapture(ev.pointerId);
}
$("viewport").addEventListener("pointerup", (ev) => finishDrag(ev));
$("viewport").addEventListener("pointercancel", (ev) => finishDrag(ev, true));
$("viewport").addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    const r = $("viewport").getBoundingClientRect();
    zoomAt(
      Math.exp(-ev.deltaY * 0.0015),
      ev.clientX - r.left,
      ev.clientY - r.top,
    );
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
  if (!selected) return;
  const next = clone(state);
  const removedViewport = current()?.type === "viewport";
  next.entities = next.entities.filter(
    (e) => e.id !== selected && (!removedViewport || e.viewportId !== selected),
  );
  if (removedViewport)
    toast("Viewporten och dess objekt har tagits bort. Ångra återställer dem.");
  selected = null;
  commit(next);
}
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
  setTool("block");
};
$("open").onclick = () => $("pdfInput").click();
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
    );
    download(
      result,
      "application/pdf",
      exportName.replace(/\.pdf$/i, "") + "-markerad.pdf",
    );
    toast(
      "PDF exporterad med inbakade markeringar. Spara projektet för fortsatt redigering.",
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
const aliases = {
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
  V: "select",
};
$("command").addEventListener("keydown", (ev) => {
  if (ev.isComposing || (ev.key !== "Enter" && ev.key !== " ")) return;
  ev.preventDefault();
  ev.stopPropagation();
  const value = ev.target.value.trim(),
    number = Number(value.replace(",", "."));
  ev.target.value = "";
  if (["HJÄLP", "HELP", "?"].includes(value.toUpperCase()))
    toast(
      "L: linje · C: cirkel · REC: rektangel · A: båge · T: text · LE: leader · BLOCK: blockbibliotek · DIM: mått · CAL: kalibrera · VP: viewport · MASK: maska · TEXTEDIT: ersätt text · GETLINE: kopiera PDF-linje · COVERLINE: täck linje · ERASELINE: ta bort PDF-linje · U: ångra · Z: anpassa · ZE: visa allt · Esc: avbryt",
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
  ev.target.blur();
});
window.addEventListener("keydown", (ev) => {
  if (
    $("documentPicker").open ||
    $("closeDocumentDialog").open ||
    $("blockLibrary").open
  )
    return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName);
  if (ev.key === "Escape") {
    $("fileMenu").open = false;
    clearTracking();
    if (pendingDialog) return;
    if (drag?.kind === "entity") state = drag.before;
    drag = null;
    points = [];
    hover = null;
    selected = null;
    tool = "select";
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
  if (ev.key === " ") space = false;
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
        await openDocument(d.bytes, d.name, d.state);
        const opened = documents.at(-1);
        opened.savedState =
          d.savedState ?? JSON.stringify({ entities: [], scales: {} });
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
  }
}
start();

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
