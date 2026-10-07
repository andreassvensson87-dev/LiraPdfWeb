const clamp = (value) => Math.max(0, Math.min(1, value));
const margin = 28;

export function documentScrollMetrics(layout, page, pan, zoom, width, height) {
  const anchor = layout[page - 1];
  if (!anchor) return null;
  const last = layout.at(-1);
  const widest = Math.max(...layout.map((item) => item.width));
  function axis(viewport, extent, origin) {
    const content = Math.max(viewport, extent + margin * 2);
    const range = content - viewport;
    const offset = margin - origin;
    return {
      viewport,
      content,
      range,
      offset,
      value: range ? clamp(offset / range) : 0,
    };
  }
  return {
    x: axis(width, widest * zoom, pan.x - ((widest - anchor.width) * zoom) / 2),
    y: axis(height, (last.top + last.height) * zoom, pan.y - anchor.top * zoom),
  };
}

export function scrollbarGeometry(length, metric) {
  const thumb = Math.min(
    length,
    Math.max(24, (length * metric.viewport) / metric.content),
  );
  const travel = length - thumb;
  return { thumb, travel, position: travel * metric.value };
}

export function setupScrollbars({
  horizontal,
  vertical,
  getMetrics,
  canScroll,
  scrollTo,
}) {
  const controls = [
    { element: horizontal, axis: "x" },
    { element: vertical, axis: "y" },
  ];
  const empty = { viewport: 1, content: 1, range: 0, offset: 0, value: 0 };

  function geometry(control) {
    const metric = getMetrics()?.[control.axis] || empty;
    const length = Math.max(
      0,
      (control.axis === "x"
        ? control.element.clientWidth
        : control.element.clientHeight) - 4,
    );
    return { ...scrollbarGeometry(length, metric), metric };
  }
  function update() {
    for (const control of controls) {
      const { thumb, position, metric } = geometry(control);
      const node = control.element.querySelector(".scrollbar-thumb");
      node.style[control.axis === "x" ? "width" : "height"] = `${thumb}px`;
      node.style[control.axis === "x" ? "left" : "top"] = `${position + 2}px`;
      control.element.setAttribute(
        "aria-valuenow",
        String(Math.round(metric.value * 100)),
      );
      control.element.setAttribute(
        "aria-valuetext",
        `${Math.round(metric.value * 100)} % ${control.axis === "x" ? "i sidled" : "genom dokumentet"}`,
      );
      control.element.setAttribute("aria-disabled", String(metric.range === 0));
      control.element.tabIndex = metric.range ? 0 : -1;
    }
  }
  for (const control of controls) {
    const { element, axis } = control;
    let drag = null;
    const coordinate = (event) => {
      const rect = element.getBoundingClientRect();
      return (
        (axis === "x" ? event.clientX - rect.left : event.clientY - rect.top) -
        2
      );
    };
    function move(event) {
      if (!drag || !canScroll()) return;
      const { travel } = geometry(control);
      if (travel)
        scrollTo({ [axis]: clamp((coordinate(event) - drag.grab) / travel) });
    }
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !canScroll()) return;
      const { metric, position, thumb } = geometry(control);
      if (!metric.range) return;
      event.preventDefault();
      const point = coordinate(event);
      drag = {
        pointerId: event.pointerId,
        grab:
          point >= position && point <= position + thumb
            ? point - position
            : thumb / 2,
      };
      element.setPointerCapture(event.pointerId);
      element.classList.add("is-dragging");
      element.focus({ preventScroll: true });
      move(event);
    });
    element.addEventListener("pointermove", (event) => {
      if (event.pointerId === drag?.pointerId) move(event);
    });
    function finish(event) {
      if (event.pointerId !== drag?.pointerId) return;
      if (event.type === "pointerup") move(event);
      drag = null;
      element.classList.remove("is-dragging");
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      element.addEventListener(type, finish);
    element.addEventListener("keydown", (event) => {
      const { metric } = geometry(control);
      if (!metric.range || !canScroll()) return;
      let value;
      if (event.key === "Home") value = 0;
      else if (event.key === "End") value = 1;
      else if (event.key === "PageUp")
        value = metric.value - (metric.viewport * 0.9) / metric.range;
      else if (event.key === "PageDown")
        value = metric.value + (metric.viewport * 0.9) / metric.range;
      else if (event.key === (axis === "x" ? "ArrowLeft" : "ArrowUp"))
        value = metric.value - 40 / metric.range;
      else if (event.key === (axis === "x" ? "ArrowRight" : "ArrowDown"))
        value = metric.value + 40 / metric.range;
      else return;
      event.preventDefault();
      event.stopPropagation();
      scrollTo({ [axis]: clamp(value) });
    });
  }
  update();
  return { update };
}
