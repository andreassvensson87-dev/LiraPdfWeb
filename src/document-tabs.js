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
export function documentTabs({ getDocuments, getActiveId, activate, close }) {
  const tabs = document.getElementById("pages"),
    dialog = document.getElementById("documentPicker"),
    search = document.getElementById("documentSearch"),
    results = document.getElementById("documentResults");
  let matches = [];
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
    render() {
      const keepFocus = tabs.contains(document.activeElement);
      const docs = getDocuments();
      tabs.replaceChildren();
      for (const d of docs) {
        const b = document.createElement("button");
        b.className =
          "document-button" + (d.id === getActiveId() ? " active" : "");
        b.textContent = d.name.replace(/\.pdf$/i, "");
        b.title = d.name;
        b.setAttribute("aria-label", d.name);
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(d.id === getActiveId()));
        b.tabIndex = d.id === getActiveId() ? 0 : -1;
        b.onclick = () => activate(d.id);
        const item = document.createElement("div");
        item.className = "document-tab-item";
        const x = document.createElement("button");
        x.className = "document-close";
        x.textContent = "×";
        x.title = `Stäng ${d.name}`;
        x.setAttribute("aria-label", `Stäng ${d.name}`);
        x.onclick = () => close(d.id);
        item.append(b, x);
        tabs.append(item);
      }
      const active = tabs.querySelector(".active");
      if (active) {
        if (keepFocus) active.focus({ preventScroll: true });
        const item = active.parentElement;
        const left = item.offsetLeft;
        if (left < tabs.scrollLeft) tabs.scrollLeft = left;
        else if (left + item.offsetWidth > tabs.scrollLeft + tabs.clientWidth)
          tabs.scrollLeft = left + item.offsetWidth - tabs.clientWidth;
      }
      document.getElementById("pagecount").textContent = String(docs.length);
      document.getElementById("allDocuments").title =
        `Sök bland ${docs.length} öppna dokument`;
      if (dialog.open) filter();
    },
  };
}
