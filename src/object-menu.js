export function setupObjectMenu({ host, open, actions }) {
  const menu = document.createElement("div");
  menu.className = "object-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Objektmeny");
  menu.hidden = true;
  document.body.append(menu);
  const close = () => {
    menu.hidden = true;
  };
  host.addEventListener("contextmenu", (event) => {
    const options = open(event);
    if (!options) return;
    event.preventDefault();
    menu.replaceChildren();
    for (const { label, action, disabled = false } of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.textContent = label;
      button.disabled = disabled;
      button.onclick = () => {
        close();
        actions[action]();
      };
      menu.append(button);
    }
    menu.hidden = false;
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
    menu.querySelector("button:not(:disabled)")?.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) close();
  });
  window.addEventListener("resize", close);
  document.addEventListener("scroll", close, true);
  menu.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      host.focus();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [...menu.querySelectorAll("button:not(:disabled)")];
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement);
      buttons[
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
      ].focus();
    }
  });
  return { close };
}
