const railIcons = {
  properties: '<path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6"/>',
  pages: '<path d="M7 3h10l4 4v14H7ZM17 3v5h4M3 7v14"/>',
  collapse: '<path d="M3 4h18v16H3ZM15 4v16m-5-11 3 3-3 3"/>',
};

/** Owns panel presentation and navigation; property edits belong to the editor. */
export function createInspector({ document, showPage, canNavigate }) {
  const properties = document.querySelector(".properties");
  const inspector = document.createElement("aside");
  inspector.className = "lira-inspector";
  inspector.setAttribute("aria-label", "Inspektor");
  const content = document.createElement("div");
  content.className = "inspector-content";
  const rail = document.createElement("div");
  rail.className = "inspector-rail";
  const tabs = document.createElement("nav");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Inspektorpaneler");
  tabs.setAttribute("aria-orientation", "vertical");
  const propertyPanel = document.createElement("section");
  propertyPanel.id = "inspector-properties";
  const heading = document.createElement("h1");
  heading.textContent = "Egenskaper";
  const context = document.createElement("p");
  context.className = "inspector-context";
  context.setAttribute("aria-live", "polite");
  propertyPanel.append(heading, context, properties);
  function section(title, selectors, open = true) {
    const details = document.createElement("details");
    details.className = "inspector-section";
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary);
    selectors.forEach((selector) =>
      details.append(properties.querySelector(selector)),
    );
    properties.append(details);
    return details;
  }
  const toolname = properties.querySelector("#toolname");
  properties.prepend(toolname);
  const appearance = section("Utseende", [
    "#circleShapeControl",
    "#styleControls",
    "#transparencyControl",
  ]);
  const stamps = section("Stämplar", ["#stampControl", "#pdfStampControls"]);
  const viewport = section("Mätområde", ["#viewportControls"]);
  const blocks = section("PDF-block", ["#blockControls"]);
  const scale = section("Mätskala", [".scale"], false);
  const pagePanel = document.createElement("section");
  pagePanel.id = "inspector-pages";
  const pageHeading = document.createElement("h1");
  pageHeading.textContent = "Sidor";
  const pageSummary = document.createElement("p");
  pageSummary.className = "inspector-context";
  const pageList = document.createElement("div");
  pageList.className = "inspector-page-list";
  pagePanel.append(pageHeading, pageSummary, pageList);
  const entries = [
    ["properties", "Egenskaper", propertyPanel],
    ["pages", "Sidor", pagePanel],
  ];
  let active = "properties",
    collapsed = false,
    pageCount = -1,
    currentPage = 0;
  const buttons = entries.map(([id, label, panel]) => {
    const button = document.createElement("button");
    button.id = `inspector-${id}-tab`;
    button.type = "button";
    button.title = label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-controls", panel.id);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${railIcons[id]}</svg>`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", button.id);
    button.onclick = () => {
      active = id;
      setCollapsed(false);
      renderPanels();
    };
    tabs.append(button);
    content.append(panel);
    return button;
  });
  function renderPages() {
    if (active !== "pages" || collapsed) return;
    if (pageList.childElementCount !== pageCount) {
      pageList.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (let page = 1; page <= pageCount; page++) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Sida ${page}`;
        button.dataset.page = page;
        button.onclick = () => {
          if (canNavigate()) showPage(page);
        };
        fragment.append(button);
      }
      pageList.append(fragment);
    }
    pageList.querySelectorAll("button").forEach((button) => {
      if (Number(button.dataset.page) === currentPage)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }
  function renderPanels() {
    entries.forEach(([id, , panel], index) => {
      panel.hidden = active !== id;
      buttons[index].setAttribute("aria-selected", String(active === id));
      buttons[index].tabIndex = active === id ? 0 : -1;
    });
    renderPages();
  }
  tabs.onkeydown = (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) %
            buttons.length;
    buttons[next].click();
    buttons[next].focus();
  };
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "inspector-collapse";
  toggle.setAttribute("aria-controls", "inspector-content");
  toggle.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${railIcons.collapse}</svg>`;
  content.id = "inspector-content";
  function setCollapsed(value) {
    collapsed = value;
    document.body.classList.toggle("lira-inspector-collapsed", value);
    content.hidden = value;
    toggle.setAttribute("aria-expanded", String(!value));
    toggle.setAttribute(
      "aria-label",
      value ? "Öppna inspektorn" : "Fäll ihop inspektorn",
    );
    toggle.title = value ? "Öppna inspektorn" : "Fäll ihop inspektorn";
  }
  toggle.onclick = () => setCollapsed(!collapsed);
  rail.append(tabs, toggle);
  inspector.append(content, rail);
  document.querySelector("main").append(inspector);
  setCollapsed(false);
  renderPanels();
  return {
    update({ pdf, page, selectionCount, toolLabel, tool }) {
      context.textContent = selectionCount
        ? `${selectionCount} ${selectionCount === 1 ? "objekt markerat" : "objekt markerade"}`
        : tool === "select"
          ? "Ingen markering"
          : `Förval · ${toolLabel}`;
      for (const details of [appearance, stamps, viewport, blocks])
        details.hidden = [...details.children]
          .filter((child) => child.tagName !== "SUMMARY")
          .every((child) => child.hidden);
      scale.hidden = !pdf;
      toolname.hidden = !selectionCount && tool === "select";
      pageCount = pdf?.numPages || 0;
      currentPage = page;
      pageSummary.textContent = pageCount
        ? `${pageCount} sidor · aktuell sida ${page}`
        : "Inget dokument öppet";
      renderPages();
    },
    showProperties() {
      active = "properties";
      renderPanels();
    },
  };
}
