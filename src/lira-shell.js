import { createInspector } from "./ui/inspector.js";

// Compose the light Lira shell around the existing command controls.
export function initializeLiraShell({ document, showPage, canNavigate }) {
  const header = document.querySelector("body > header");
  const history = document.querySelector(".history");
  header.insertBefore(history, document.getElementById("filename"));
  document
    .querySelector(".footer-actions")
    .prepend(document.getElementById("zoom"));
  const entry = document.querySelector(".command");
  const commandPanel = document.createElement("section");
  commandPanel.className = "lira-command-panel";
  commandPanel.setAttribute("aria-label", "Kommandorad");
  const log = document.createElement("div");
  log.id = "lira-command-log";
  log.setAttribute("role", "log");
  log.setAttribute("aria-label", "Senaste kommandon");
  const label = document.createElement("label");
  label.htmlFor = "command";
  label.textContent = "Kommando";
  entry.insertBefore(label, document.getElementById("command"));
  commandPanel.append(log, entry);
  document.body.insertBefore(
    commandPanel,
    document.querySelector("body > footer"),
  );
  const fileMenu = document.getElementById("fileMenu");
  fileMenu.addEventListener("click", (event) => {
    if (event.target.closest("button")) fileMenu.open = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!fileMenu.contains(event.target)) fileMenu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") fileMenu.open = false;
  });
  document.getElementById("togglePages").onclick = () => {
    const collapsed = document
      .getElementById("pagePanel")
      .classList.toggle("documents-collapsed");
    document
      .getElementById("togglePages")
      .setAttribute("aria-expanded", String(!collapsed));
  };
  return createInspector({ document, showPage, canNavigate });
}
