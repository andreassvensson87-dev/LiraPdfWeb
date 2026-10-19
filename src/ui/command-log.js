export function createCommandLog({ document, log }) {
  function recordCommand(value) {
    const line = document.createElement("div");
    line.textContent = `› ${value}`;
    log.append(line);
    while (log.children.length > 30) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  return { recordCommand };
}
