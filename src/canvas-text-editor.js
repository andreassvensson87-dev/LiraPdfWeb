// A document-coordinate editor that follows the canvas through zoom and pan.
export function editCanvasText({
  overlay,
  point,
  fontSize,
  color,
  value = "",
  singleLine = false,
  onFinish,
  onSave,
}) {
  const editor = document.createElement("textarea");
  editor.className = "canvas-text-editor";
  editor.setAttribute("aria-label", "Redigera text på ritningen");
  editor.setAttribute("spellcheck", "false");
  editor.title = "Ctrl+Enter: klar · Esc: avbryt · klicka utanför: klar";
  editor.value = value;
  editor.rows = 1;
  const context = document.createElement("canvas").getContext("2d");
  let frame,
    closed = false;
  const size = () => {
    context.font = `${fontSize}px Helvetica, Arial, sans-serif`;
    const lines = editor.value.split("\n");
    editor.style.width = `${Math.max(100, ...lines.map((line) => context.measureText(line || " ").width + 16))}px`;
    editor.style.height = `${Math.max(fontSize * 1.4, lines.length * fontSize * 1.25 + 8)}px`;
  };
  const position = () => {
    if (closed) return;
    const matrix = overlay.getScreenCTM();
    if (matrix) {
      const x = point.x,
        y = point.y - fontSize;
      editor.style.transform = `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.a * x + matrix.c * y + matrix.e},${matrix.b * x + matrix.d * y + matrix.f})`;
    }
    frame = requestAnimationFrame(position);
  };
  const finish = (cancel = false) => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("pointerdown", outside, true);
    editor.remove();
    onFinish(cancel ? null : editor.value);
  };
  const outside = (event) => {
    if (event.target !== editor) finish();
  };
  editor.style.fontSize = `${fontSize}px`;
  editor.style.color = color;
  editor.addEventListener("pointerdown", (event) => event.stopPropagation());
  editor.addEventListener("input", size);
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(true);
    } else if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey || singleLine)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    } else if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "s"
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
      queueMicrotask(() => onSave?.(event.shiftKey));
    } else event.stopPropagation();
  });
  document.body.append(editor);
  size();
  position();
  editor.focus();
  editor.select();
  document.addEventListener("pointerdown", outside, true);
  return { finish };
}
