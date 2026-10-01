export function exactPoint(input, { base, origin = { x: 0, y: 0 }, scale }) {
  const value = input.trim();
  if (!/[@#,;<]/.test(value)) return null;
  if (!(scale > 0))
    throw Error("Kalibrera pappret eller välj en viewport först.");
  const num = (s) => {
    if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s))
      throw Error("Ogiltigt tal.");
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n)) throw Error("Ogiltigt tal.");
    return n;
  };
  if (value.includes("<")) {
    if (!base) throw Error("Välj en startpunkt först.");
    const parts = value.replace(/^[@#]/, "").split("<");
    if (parts.length !== 2) throw Error("Använd längd<vinkel.");
    const length = num(parts[0]),
      angle = (num(parts[1]) * Math.PI) / 180;
    if (length <= 0) throw Error("Längden måste vara positiv.");
    return {
      x: base.x + (length / scale) * Math.cos(angle),
      y: base.y - (length / scale) * Math.sin(angle),
    };
  }
  const relative = value.startsWith("@"),
    raw = value.replace(/^[@#]/, "");
  // A comma alone in a decimal length is handled by the ordinary length command.
  const parts = raw.split(raw.includes(";") ? ";" : ",");
  if (parts.length !== 2) {
    if (relative) throw Error("Använd @x,y eller @x;y.");
    return null;
  }
  if (relative && !base)
    throw Error("Relativa koordinater behöver en startpunkt.");
  const o = relative ? base : origin;
  return { x: o.x + num(parts[0]) / scale, y: o.y - num(parts[1]) / scale };
}
export function referenceValue(kind, oldValue, newValue) {
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue))
    throw Error("Ogiltigt referensmått.");
  if (kind === "scale") {
    if (oldValue <= 0 || newValue <= 0)
      throw Error("Referenslängder måste vara positiva.");
    return newValue / oldValue;
  }
  return newValue - oldValue;
}
