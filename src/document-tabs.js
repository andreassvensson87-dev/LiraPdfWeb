export function matchingDocuments(documents, query) {
  const words = query
    .trim()
    .toLocaleLowerCase("sv-SE")
    .split(/\s+/)
    .filter(Boolean);
  return documents.filter((d) =>
    words.every((word) => d.name.toLocaleLowerCase("sv-SE").includes(word)),
  );
}
export function reorderDocuments(documents, id, targetId, after = false) {
  if (id === targetId) return documents;
  const source = documents.find((d) => d.id === id);
  if (!source || !documents.some((d) => d.id === targetId)) return documents;
  const next = documents.filter((d) => d.id !== id);
  const index = next.findIndex((d) => d.id === targetId) + Number(after);
  next.splice(index, 0, source);
  return next.every((d, i) => d === documents[i]) ? documents : next;
}

export function documentTabs({
  getDocuments,
  getActiveId,
  isChanged = () => false,
  activate,
  close,
  reorder,
}) {
  const tabs = document.getElementById("pages"),
    dialog = document.getElementById("documentPicker"),
    search = document.getElementById("documentSearch"),
    results = document.getElementById("documentResults");
  let matches = [];
  const tabButtons = new Map();
  function updateChanges() {
    for (const d of getDocuments()) {
      const button = tabButtons.get(d.id);
      if (!button) continue;
      const changed = isChanged(d);
      button.textContent =
        (changed ? "* " : "") + d.name.replace(/\.pdf$/i, "");
      button.title =
        d.name +
        (changed ? "\nOsparade ändringar" : "") +
        (reorder ? "\nDra för att ändra flikordning" : "");
      button.setAttribute(
        "aria-label",
        d.name + (changed ? ", osparade ändringar" : ""),
      );
    }
  }
  let draggedId = null,
    scrollFrame = 0,
    pointerX = 0,
    pointerY = 0;
  function clearDropMarker() {
    tabs
      .querySelectorAll("[data-drop-side]")
      .forEach((item) => delete item.dataset.dropSide);
  }
  function finishDrag() {
    draggedId = null;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    clearDropMarker();
    tabs.querySelector(".is-dragging")?.classList.remove("is-dragging");
  }
  function dropTarget() {
    const items = [...tabs.children].map((item) => ({
      item,
      rect: item.getBoundingClientRect(),
    }));
    const hit =
      items.find(({ rect }) => pointerX <= rect.right) || items.at(-1);
    if (!hit) return null;
    return {
      item: hit.item,
      after: pointerX >= hit.rect.left + hit.rect.width / 2,
    };
  }
  function markDrop() {
    clearDropMarker();
    const hit = dropTarget();
    if (hit && hit.item.dataset.documentId !== draggedId)
      hit.item.dataset.dropSide = hit.after ? "after" : "before";
  }
  function autoScroll() {
    scrollFrame = 0;
    if (!draggedId) return;
    const rect = tabs.getBoundingClientRect();
    if (pointerY < rect.top || pointerY > rect.bottom) return;
    const edge = 32;
    const velocity =
      pointerX < rect.left + edge
        ? -12 * Math.min(1, (rect.left + edge - pointerX) / edge)
        : pointerX > rect.right - edge
          ? 12 * Math.min(1, (pointerX - rect.right + edge) / edge)
          : 0;
    const before = tabs.scrollLeft;
    tabs.scrollLeft += velocity;
    if (tabs.scrollLeft === before) return;
    markDrop();
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  tabs.addEventListener("dragstart", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab || !reorder) {
      e.preventDefault();
      return;
    }
    draggedId = tab.parentElement.dataset.documentId;
    tab.parentElement.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedId);
  });
  tabs.addEventListener("dragover", (e) => {
    if (!draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    pointerX = e.clientX;
    pointerY = e.clientY;
    markDrop();
    if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
  });
  tabs.addEventListener("dragleave", (e) => {
    if (tabs.contains(e.relatedTarget)) return;
    clearDropMarker();
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  });
  tabs.addEventListener("drop", (e) => {
    if (!draggedId) return;
    e.preventDefault();
    pointerX = e.clientX;
    const hit = dropTarget(),
      id = draggedId;
    finishDrag();
    if (hit) reorder(id, hit.item.dataset.documentId, hit.after);
  });
  tabs.addEventListener("dragend", finishDrag);
  function choose(id) {
    dialog.close();
    activate(id);
  }
  function filter() {
    matches = matchingDocuments(getDocuments(), search.value);
    results.replaceChildren();
    document.getElementById("documentMatches").textContent =
      `${matches.length} av ${getDocuments().length} dokument`;
    for (const d of matches) {
      const button = document.createElement("button");
      button.className = "document-result";
      button.textContent = d.name;
      button.title = d.name;
      button.setAttribute("aria-current", String(d.id === getActiveId()));
      button.onclick = () => choose(d.id);
      results.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "no-documents";
      empty.textContent = "Inga dokument matchar sökningen.";
      results.append(empty);
    }
  }
  search.oninput = filter;
  search.onkeydown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      results.querySelector("button")?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[0]) choose(matches[0].id);
    }
  };
  results.onkeydown = (e) => {
    const buttons = [...results.querySelectorAll("button")],
      index = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = index + (e.key === "ArrowDown" ? 1 : -1);
      if (next < 0) search.focus();
      else buttons[Math.min(next, buttons.length - 1)]?.focus();
    }
  };
  document.getElementById("allDocuments").onclick = () => {
    search.value = "";
    filter();
    dialog.showModal();
    search.focus();
  };
  document.getElementById("closeDocumentPicker").onclick = () => dialog.close();
  tabs.addEventListener(
    "wheel",
    (e) => {
      if (tabs.scrollWidth <= tabs.clientWidth || e.ctrlKey) return;
      e.preventDefault();
      tabs.scrollLeft +=
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    },
    { passive: false },
  );
  tabs.addEventListener("keydown", (e) => {
    const buttons = [...tabs.querySelectorAll('[role="tab"]')],
      index = buttons.indexOf(e.target);
    if (index < 0) return;
    if (
      reorder &&
      e.ctrlKey &&
      e.shiftKey &&
      ["ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
      const target = buttons[index + (e.key === "ArrowRight" ? 1 : -1)];
      if (!target) return;
      const id = e.target.parentElement.dataset.documentId;
      reorder(
        id,
        target.parentElement.dataset.documentId,
        e.key === "ArrowRight",
      );
      [...tabs.children]
        .find((item) => item.dataset.documentId === id)
        ?.querySelector('[role="tab"]')
        ?.focus();
      return;
    }
    let next;
    if (e.key === "ArrowRight") next = (index + 1) % buttons.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else return;
    e.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.click();
  });
  return {
    updateChanges,
    render({ revealActive = true } = {}) {
      finishDrag();
      const keepFocus = tabs.contains(document.activeElement);
      const scrollLeft = tabs.scrollLeft;
      const docs = getDocuments();
      tabs.replaceChildren();
      tabButtons.clear();
      for (const d of docs) {
        const b = document.createElement("button");
        b.className =
          "document-button" + (d.id === getActiveId() ? " active" : "");
        tabButtons.set(d.id, b);
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(d.id === getActiveId()));
        b.tabIndex = d.id === getActiveId() ? 0 : -1;
        b.draggable = !!reorder;
        if (reorder)
          b.setAttribute(
            "aria-keyshortcuts",
            "Control+Shift+ArrowLeft Control+Shift+ArrowRight",
          );
        b.onclick = () => activate(d.id);
        const item = document.createElement("div");
        item.className = "document-tab-item";
        item.dataset.documentId = d.id;
        const x = document.createElement("button");
        x.className = "document-close";
        x.textContent = "×";
        x.title = `Stäng ${d.name}`;
        x.setAttribute("aria-label", `Stäng ${d.name}`);
        x.onclick = () => close(d.id);
        item.append(b, x);
        tabs.append(item);
      }
      updateChanges();
      tabs.scrollLeft = scrollLeft;
      const active = tabs.querySelector(".active");
      if (active) {
        if (keepFocus) active.focus({ preventScroll: true });
        const item = active.parentElement;
        const left = item.offsetLeft;
        if (revealActive && left < tabs.scrollLeft) tabs.scrollLeft = left;
        else if (
          revealActive &&
          left + item.offsetWidth > tabs.scrollLeft + tabs.clientWidth
        )
          tabs.scrollLeft = left + item.offsetWidth - tabs.clientWidth;
      }
      document.getElementById("pagecount").textContent = String(docs.length);
      document.getElementById("allDocuments").title =
        `Sök bland ${docs.length} öppna dokument`;
      if (dialog.open) filter();
    },
  };
}
