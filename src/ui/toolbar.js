import { tools } from "../editor/tool-catalog.js";
import { toolIcon } from "./icons.js";

// Placement is explicit; this module presents commands without owning edits.
const groups = {
  create: [
    ["Geometri", ["line", "rect", "circle", "arc"]],
    [
      "Text och markering",
      ["text", "leader", "freehand", "highlight", "cloud"],
    ],
    ["Stämplar och block", ["stamp", "block"]],
  ],
  edit: [
    ["Placering", ["move", "copy", "rotate", "scale", "mirror"]],
    ["Forma", ["offset", "trim", "extend", "fillet", "chamfer"]],
    ["Objekt och hörn", ["join", "explode", "pinsert", "pdelete", "erase"]],
  ],
  measure: [
    ["Mätning", ["dim", "measureCalibrate"]],
    ["Mätområden", ["viewport"]],
  ],
  pdf: [
    ["PDF-innehåll", ["extract", "eraseLine", "eraseText"]],
    ["Täckning", ["mask", "coverLine", "replace"]],
    ["Sidrotation", ["rotatePageCW", "rotatePageCCW"]],
  ],
  view: [
    ["Navigering", ["fit", "fitAll", "zoomOut", "zoomIn"]],
    ["Arbetsyta", ["togglePages"]],
  ],
};

export function createToolbar({ document, activate, canInteract }) {
  const ribbon = document.getElementById("toolRibbon");
  const tabs = [...document.querySelectorAll("[data-category]")];
  const host = document.getElementById("tools");
  const controls = new Map();
  for (const [id, , label, shortcut] of tools) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool";
    button.dataset.tool = id;
    button.title = `${label} (${shortcut})`;
    button.setAttribute("aria-label", `${label} (${shortcut})`);
    button.innerHTML = toolIcon(id);
    const caption = document.createElement("span");
    caption.textContent = label;
    button.append(caption);
    button.onclick = () => {
      if (canInteract()) activate(id);
    };
    controls.set(id, button);
  }
  function section(label, ids, category) {
    const group = document.createElement("section");
    group.className = "toolbar-section";
    group.setAttribute("aria-label", label);
    if (category) group.dataset.toolCategory = category;
    const heading = document.createElement("h2");
    heading.textContent = label;
    group.style.gridTemplateColumns = `repeat(${1 + Math.ceil((ids.length - 1) / 2)}, max-content)`;
    ids.forEach((id, index) => {
      const control = controls.get(id) || document.getElementById(id);
      if (!control) throw Error(`Verktygskontroll saknas: ${id}`);
      if (id === "togglePages" && !control.querySelector("span")) {
        const caption = document.createElement("span");
        caption.textContent = "Dokumentrad";
        control.append(caption);
      }
      control.hidden = false;
      if (index > 0) {
        control.style.gridColumn = String(2 + Math.floor((index - 1) / 2));
        control.style.gridRow = String(1 + ((index - 1) % 2));
      }
      if (control.tagName === "BUTTON") control.classList.add("ribbon-command");
      if (index === 0 && control.tagName === "BUTTON")
        control.classList.add("ribbon-large");
      group.append(control);
    });
    group.append(heading);
    host.append(group);
  }
  section("Urval", ["select"]);
  for (const [category, entries] of Object.entries(groups))
    entries.forEach(([label, ids]) => section(label, ids, category));
  // All actual controls were adopted above; remove the empty legacy wrappers.
  ribbon.querySelectorAll(".viewtools").forEach((node) => node.remove());
  ribbon.append(host);
  function showCategory(category) {
    if (!groups[category]) return;
    tabs.forEach((button) => {
      const active = button.dataset.category === category;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) ribbon.setAttribute("aria-labelledby", button.id);
    });
    host.querySelectorAll("[data-tool-category]").forEach((group) => {
      group.hidden = group.dataset.toolCategory !== category;
    });
  }
  tabs.forEach((button, index) => {
    button.onclick = () => {
      if (canInteract()) showCategory(button.dataset.category);
    };
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
              tabs.length;
      tabs[next].click();
      tabs[next].focus();
    };
  });
  showCategory("create");
  return { showCategory };
}
