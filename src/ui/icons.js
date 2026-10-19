export const toolIconPaths = {
  rotate: '<path d="M5 8a8 8 0 1 1-1 9M5 3v5h5"/>',
  scale:
    '<rect x="3" y="13" width="8" height="8"/><path d="M3 9V3h18v18h-6M12 12l7-7m-5 0h5v5"/>',
  mirror: '<path d="M12 2v20M8 5 2 19h6ZM16 5l6 14h-6Z"/>',
  trim: '<path d="M8 2v20M16 2v20M2 12h6m8 0h6m-12-3 4 6m0-6-4 6"/>',
  extend: '<path d="M19 3v18M2 12h17m-5-4 5 4-5 4"/>',
  erase: '<path d="m3 15 10-12 8 7-10 12H8ZM8 10l8 7"/>',
  join: '<path d="M2 16h8v-8h12M7 12l3 4 3-4"/>',
  explode: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  fillet: '<path d="M3 21V11a8 8 0 0 1 8-8h10"/>',
  chamfer: '<path d="M3 21V11l8-8h10"/>',
  pinsert: '<path d="M2 20 12 6l10 14M12 2v8M8 6h8"/>',
  pdelete: '<path d="M2 20h20M8 6h8"/>',
  move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M5 16H3V3h13v2"/>',
  offset: '<path d="M3 20V4h16M8 20V9h11M13 20v-6h6"/>',
  block:
    '<rect x="4" y="3" width="13" height="17"/><path d="M9 12h12m-6-6v12"/>',
  viewport:
    '<rect x="3" y="4" width="18" height="16" stroke-dasharray="3 2"/><path d="M8 9h8v6H8Z"/>',
  select: '<path d="m5 3 14 9-7 1-3 7Z"/>',
  freehand: '<path d="M3 17c3-10 5 7 8-3s4-10 5-5M14 7l5-5 3 3-5 5-4 1Z"/>',
  line: '<path d="M5 19 19 5"/><rect x="3" y="17" width="4" height="4"/><rect x="17" y="3" width="4" height="4"/>',
  highlight: '<path d="m5 16 10-10 5 5-10 10H5ZM3 22h12"/>',
  cloud:
    '<path d="M6 18a4 4 0 0 1-1-8 5 5 0 0 1 9-4 4 4 0 0 1 6 6 3 3 0 0 1-2 6Z"/>',
  stamp: '<path d="M5 20h14M4 17h16v-4H4ZM9 13V5a3 3 0 0 1 6 0v8"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  rect: '<rect x="3" y="5" width="18" height="14" rx="1"/>',
  arc: '<path d="M4 19A15 15 0 0 1 19 4"/><path d="M2 19h4M19 2v4"/>',
  text: '<path d="M5 5h14M12 5v15M8 20h8"/>',
  leader: '<path d="m3 20 9-12h9M3 14v6h6"/>',
  coverLine: '<path d="M4 18 18 4M7 21 21 7"/>',
  eraseText: '<path d="M4 4h14M11 4v15M7 19h8M16 12l6 6m0-6-6 6"/>',
  eraseLine: '<path d="M4 20 20 4M12 5l7 7M4 4l16 16"/>',
  extract:
    '<path d="M4 16 16 4m-1 9h6m-3-3v6"/><rect x="2" y="14" width="4" height="4"/><rect x="14" y="2" width="4" height="4"/>',
  mask: '<rect x="3" y="5" width="18" height="14"/><path d="m4 15 10-10m-4 14L21 8m-5 11 5-5"/>',
  dim: '<path d="M4 5v14M20 5v14M4 12h16m-12-3-4 3 4 3m8-6 4 3-4 3"/>',
};
export function toolIcon(id) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${toolIconPaths[id] || toolIconPaths.select}</svg>`;
}
