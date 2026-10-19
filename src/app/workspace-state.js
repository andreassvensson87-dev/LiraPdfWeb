// State belongs to one application instance. Document data, view state and
// transient interaction state have separate lifecycles.
export function createWorkspaceState() {
  const session = {
    pageCount: undefined,
    state: { entities: [], scales: {} },
    undoStack: [],
    redoStack: [],
  };
  const workspace = {
    scrollLoading: false,
    queuedScroll: { x: 0, y: 0 },
    queuedScrollbarPosition: {},
    pdf: undefined,
    bytes: undefined,
    name: "Exempelritning.pdf",
    pageNo: 1,
    viewport: undefined,
    zoom: 1,
    pan: { x: 20, y: 20 },
    busy: false,
    epoch: 0,
    pdfSegments: [],
    textItems: [],
    removableTextTargets: [],
    activeId: null,
    restoring: false,
    recoveryBlocked: false,
    unrestoredDocuments: [],
  };
  const interaction = {
    selection: new Set(),
    snapHit: null,
    activeGrip: null,
    lastTool: null,
    spacePanned: false,
    editOperation: null,
    polar: true,
    otrack: true,
    polarAngle: 45,
    trackingAnchors: [],
    aidGuides: [],
    trackTimer: undefined,
    pendingBlock: null,
    tool: "select",
    points: [],
    hover: null,
    selected: null,
    ortho: false,
    snap: true,
    space: false,
    drag: null,
    pendingDialog: null,
    inlineTextId: null,
  };

  return { session, workspace, interaction };
}
