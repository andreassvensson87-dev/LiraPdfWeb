const icons = {
  freehand: '<path d="M3 17c3-10 5 7 8-3s4-10 5-5M14 7l5-5 3 3-5 5-4 1Z"/>',
  line: '<path d="M5 19 19 5"/>',
  rect: '<rect x="3" y="5" width="18" height="14" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  arc: '<path d="M4 19A15 15 0 0 1 19 4"/>',
  text: '<path d="M5 5h14M12 5v15M8 20h8"/>',
  leader: '<path d="m3 20 9-12h9M3 14v6h6"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
};
function icon(tool) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = icons[tool];
  return svg;
}
const key = "lirapdf-quick-tools-v1";
export function setupQuickTools({
  host,
  tools,
  current,
  canUse,
  activate,
  error,
}) {
  const labels = new Map(tools.map(([id, , label]) => [id, label]));
  const valid = (p) =>
    p &&
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    p.name.length <= 60 &&
    labels.has(p.tool) &&
    /^#[0-9a-f]{6}$/i.test(p.color) &&
    (p.opacity === undefined ||
      (Number.isFinite(p.opacity) && p.opacity >= 0 && p.opacity <= 1)) &&
    Number.isFinite(p.width) &&
    p.width >= 0.2 &&
    p.width <= 20 &&
    Number.isFinite(p.fontSize) &&
    p.fontSize >= 4 &&
    p.fontSize <= 96;
  let presets = [
    {
      id: "review-green",
      name: "Granskat",
      tool: "freehand",
      color: "#147b60",
      width: 5,
      fontSize: 12,
    },
  ];
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) presets = saved.filter(valid).slice(0, 50);
  } catch {
    /* Keep the default when storage is unavailable. */
  }
  const bar = document.createElement("section");
  bar.className = "quick-tools";
  bar.setAttribute("aria-label", "Egna snabbverktyg");
  host.append(bar);
  const dialog = document.createElement("dialog");
  dialog.className = "quick-tools-dialog";
  dialog.innerHTML = `<form>
    <h2>Egna snabbverktyg</h2>
    <p>Spara verktyg, färg och bredd för snabb granskning.</p>
    <div class="quick-tools-saved" aria-label="Sparade snabbverktyg"></div>
    <label>Namn<input name="name" maxlength="60" required placeholder="Till exempel Granskat"></label>
    <label>Verktyg<select name="tool"></select></label>
    <label>Färg<input name="color" type="color" required></label>
    <label>Bredd <span class="quick-unit">px vid 100 % zoom</span><input name="width" type="number" min="0.2" max="20" step="0.2" required></label>
    <label>Genomskinlighet (%)<input name="transparency" type="number" min="0" max="100" step="1" required></label>
    <label class="quick-font">Textstorlek (pt)<input name="fontSize" type="number" min="4" max="96" required></label>
    <div class="quick-tools-actions"><button type="button" class="quick-new">Nytt</button><button type="submit">Spara snabbverktyg</button><button type="button" class="quick-close">Stäng</button></div>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const field = (name) => form.elements.namedItem(name);
  let editing = null;
  for (const [id, , label] of tools) field("tool").add(new Option(label, id));
  function units() {
    dialog.querySelector(".quick-unit").textContent =
      field("tool").value === "freehand" ? "(px vid 100 % zoom)" : "(pt)";
    dialog.querySelector(".quick-font").hidden = !["text", "leader"].includes(
      field("tool").value,
    );
  }
  field("tool").onchange = units;
  function fill(p, id = null) {
    editing = id;
    for (const name of ["name", "tool", "color", "width", "fontSize"])
      field(name).value = p[name];
    field("transparency").value = Math.round((1 - (p.opacity ?? 1)) * 100);
    units();
  }
  const description = (p) =>
    `${labels.get(p.tool)} · ${p.width} ${p.tool === "freehand" ? "px" : "pt"}${(p.opacity ?? 1) < 1 ? ` · ${Math.round((1 - p.opacity) * 100)} % genomskinlig` : ""}`;
  function persist(next) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      error(Error("Snabbverktygen kunde inte sparas i webbläsaren."));
      return false;
    }
    presets = next;
    render();
    return true;
  }
  function render() {
    bar.replaceChildren();
    const saved = dialog.querySelector(".quick-tools-saved");
    saved.replaceChildren();
    for (const p of presets) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "quick-preset";
      b.title = `${p.name} · ${description(p)} · ${p.color}`;
      b.setAttribute("aria-label", `${p.name} · ${description(p)}`);
      b.dataset.presetId = p.id;
      b.style.color = p.color;
      b.append(icon(p.tool));
      b.onclick = () => {
        if (canUse()) activate(p);
      };
      bar.append(b);
      const row = document.createElement("div");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = `${p.name} · ${description(p)}`;
      edit.onclick = () => fill(p, p.id);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Ta bort";
      remove.setAttribute("aria-label", `Ta bort ${p.name}`);
      remove.onclick = () => {
        if (persist(presets.filter((x) => x.id !== p.id)) && editing === p.id)
          fresh();
      };
      row.append(edit, remove);
      saved.append(row);
    }
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "quick-manage";
    manage.title = "Anpassa snabbverktyg";
    manage.setAttribute("aria-label", "Anpassa snabbverktyg");
    manage.append(icon("add"));
    manage.onclick = () => {
      if (canUse()) {
        fresh();
        dialog.showModal();
      }
    };
    bar.append(manage);
    updateActive();
  }
  function fresh() {
    const p = current();
    fill({ ...p, name: "", tool: labels.has(p.tool) ? p.tool : "freehand" });
  }
  dialog.querySelector(".quick-new").onclick = fresh;
  dialog.querySelector(".quick-close").onclick = () => dialog.close();
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const p = {
      id: editing || crypto.randomUUID(),
      name: field("name").value.trim(),
      tool: field("tool").value,
      color: field("color").value,
      opacity: 1 - Number(field("transparency").value) / 100,
      width: Number(field("width").value),
      fontSize: Number(field("fontSize").value),
    };
    if (!p.name || !valid(p)) return;
    if (!editing && presets.length >= 50) {
      error(Error("Du kan spara högst 50 snabbverktyg."));
      return;
    }
    if (
      persist(
        editing
          ? presets.map((x) => (x.id === editing ? p : x))
          : [...presets, p],
      )
    ) {
      editing = p.id;
      activate(p);
      dialog.close();
    }
  };
  function updateActive() {
    const active = current();
    for (const button of bar.querySelectorAll("[data-preset-id]")) {
      const p = presets.find((p) => p.id === button.dataset.presetId);
      const matches =
        active.tool === p.tool &&
        active.color === p.color &&
        active.width === p.width &&
        (active.opacity ?? 1) === (p.opacity ?? 1) &&
        (!["text", "leader"].includes(p.tool) ||
          active.fontSize === p.fontSize);
      button.setAttribute("aria-pressed", String(matches));
    }
  }
  const rail = host.querySelector(".lira-rail");
  const position = () => {
    const top = rail.offsetTop + rail.offsetHeight + 10;
    bar.style.top = `${top}px`;
    bar.style.maxHeight = `${Math.max(42, host.clientHeight - top - 90)}px`;
  };
  const observer = new ResizeObserver(position);
  observer.observe(rail);
  observer.observe(host);
  render();
  position();
  return { updateActive };
}
