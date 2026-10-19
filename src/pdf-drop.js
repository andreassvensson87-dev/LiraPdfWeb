// Capture files and handle promises during drop; the browser clears DataTransfer afterwards.
export function setupPdfDrop({
  target = document,
  ready = Promise.resolve(),
  canOpen,
  open,
  error,
  waiting = () => {},
}) {
  let depth = 0,
    queue = Promise.resolve();
  const isFiles = (event) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");
  const reset = () => {
    depth = 0;
    document.body.classList.remove("pdf-drop-active");
  };
  target.addEventListener("dragenter", (event) => {
    if (!isFiles(event)) return;
    event.preventDefault();
    depth++;
    document.body.classList.add("pdf-drop-active");
  });
  target.addEventListener("dragover", (event) => {
    if (!isFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  target.addEventListener("dragleave", (event) => {
    if (!isFiles(event)) return;
    if (--depth <= 0) reset();
  });
  target.addEventListener("dragend", reset);
  window.addEventListener("blur", reset);
  target.addEventListener("drop", (event) => {
    if (!isFiles(event)) return;
    event.preventDefault();
    reset();
    const items = Array.from(event.dataTransfer.items || []).filter(
      (item) => item.kind === "file",
    );
    const entries = items.length
      ? items.map((item) => {
          const file = item.getAsFile();
          let handle;
          try {
            handle = item.getAsFileSystemHandle?.();
          } catch {}
          return { file, handle: Promise.resolve(handle).catch(() => null) };
        })
      : Array.from(event.dataTransfer.files || []).map((file) => ({ file }));
    queue = queue
      .then(async () => {
        await ready;
        let found = false;
        for (const entry of entries) {
          try {
            const handle = await entry.handle;
            if (handle?.kind === "directory") continue;
            const file = entry.file || (await handle?.getFile());
            if (!file || !/\.pdf$/i.test(file.name)) continue;
            found = true;
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!canOpen()) waiting();
            while (!canOpen())
              await new Promise((resolve) => setTimeout(resolve, 200));
            await open(bytes, file.name, handle || null);
          } catch (e) {
            error(e);
          }
        }
        if (!found) error(Error("Dra in en PDF-fil för att öppna den."));
      })
      .catch(error);
  });
}
