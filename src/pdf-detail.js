// Rasterize only the visible page region at the screen's actual pixel density.
export function detailRegion({
  width,
  height,
  zoom,
  pan,
  screenWidth,
  screenHeight,
  dpr = 1,
}) {
  if (
    ![width, height, zoom, screenWidth, screenHeight].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return null;
  const margin = 100 / zoom;
  const x = Math.max(0, -pan.x / zoom - margin);
  const y = Math.max(0, -pan.y / zoom - margin);
  const right = Math.min(width, (screenWidth - pan.x) / zoom + margin);
  const bottom = Math.min(height, (screenHeight - pan.y) / zoom + margin);
  if (right <= x || bottom <= y) return null;
  const w = right - x,
    h = bottom - y;
  const scale = Math.min(
    zoom * Math.max(1, dpr),
    Math.sqrt(12000000 / (w * h)),
    8192 / Math.max(w, h),
  );
  return {
    x,
    y,
    width: w,
    height: h,
    scale,
    pixelsWide: Math.max(1, Math.floor(w * scale)),
    pixelsHigh: Math.max(1, Math.floor(h * scale)),
  };
}
export function createDetailRenderer(sheet) {
  let page = null,
    release = null,
    task = null,
    canvas = null,
    timer,
    generation = 0,
    lastKey = "";
  async function clear() {
    generation++;
    clearTimeout(timer);
    const previous = task,
      dispose = release;
    task = null;
    page = null;
    release = null;
    lastKey = "";
    previous?.cancel();
    canvas?.remove();
    canvas = null;
    await previous?.promise.catch(() => {});
    await dispose?.();
  }
  function setPage(source, dispose) {
    page = source;
    release = dispose;
  }
  function update(view) {
    if (!page) return;
    const region = detailRegion(view),
      key = JSON.stringify(region);
    if (key === lastKey) return;
    lastKey = key;
    const ticket = ++generation,
      source = page;
    clearTimeout(timer);
    task?.cancel();
    if (!region) {
      canvas?.remove();
      canvas = null;
      return;
    }
    timer = setTimeout(async () => {
      const buffer = document.createElement("canvas");
      buffer.className = "pdf-detail";
      buffer.setAttribute("aria-hidden", "true");
      buffer.width = region.pixelsWide;
      buffer.height = region.pixelsHigh;
      Object.assign(buffer.style, {
        left: `${region.x}px`,
        top: `${region.y}px`,
        width: `${buffer.width / region.scale}px`,
        height: `${buffer.height / region.scale}px`,
      });
      let rendering;
      try {
        rendering = source.render({
          canvasContext: buffer.getContext("2d"),
          viewport: source.getViewport({ scale: region.scale }),
          transform: [
            1,
            0,
            0,
            1,
            -region.x * region.scale,
            -region.y * region.scale,
          ],
        });
        task = rendering;
        await rendering.promise;
        if (ticket !== generation) return;
        canvas?.remove();
        sheet.insertBefore(buffer, sheet.querySelector("#overlay"));
        canvas = buffer;
      } catch (error) {
        if (ticket === generation) lastKey = "";
        if (error.name !== "RenderingCancelledException")
          console.error("PDF detail rendering failed", error);
      } finally {
        if (task === rendering) task = null;
      }
    }, 100);
  }
  return { clear, setPage, update };
}
