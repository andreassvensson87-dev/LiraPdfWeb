import { watchAppUpdate } from "./update-ui.js";
export function setupPWA(beforeUpdate) {
  if (!import.meta.env.PROD) return;
  const header = document.querySelector("body > header");
  const update = document.createElement("button");
  const install = document.createElement("button");
  const status = document.querySelector("#saveStatus");
  update.hidden = install.hidden = true;
  install.textContent = "Installera app";
  header.insertBefore(update, document.querySelector("#save"));
  header.insertBefore(install, update);
  let prompt;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event;
    install.hidden = false;
  });
  install.onclick = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    install.hidden = true;
  };
  window.addEventListener("appinstalled", () => {
    install.hidden = true;
  });
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((reg) => watchAppUpdate(reg, update, status, beforeUpdate))
      .catch(() => {
        status.textContent = "Offlinefunktion är inte tillgänglig.";
      });
}
