import { createQuickToolStore } from "../infrastructure/quick-tool-store.js";
import { createDocumentPresentation } from "../ui/document-presentation.js";
import { loadPdf } from "../pdf/viewer.js";
import { readEditablePdf, saveEditablePdf } from "../editable-pdf.js";
import { choosePdfTarget, writePdfFile } from "../pdf-file-save.js";
import { createCommandLog } from "../ui/command-log.js";
import { bindKeyboard } from "../input/keyboard-bindings.js";
import { createViewportNavigation } from "../rendering/viewport-navigation.js";
import { createPdfContentActions } from "../editor/pdf-content-actions.js";
import { createPageRenderer } from "../rendering/page-renderer.js";
import { createPageController } from "./page-controller.js";
import { download, base64 } from "../file-data.js";
import { createQuickToolController } from "../ui/quick-tool-controller.js";
import { createLibraryController } from "./library-controller.js";
import { createDocumentSelectors } from "../editor/document-selectors.js";
import { createWorkspaceState } from "./workspace-state.js";
import { createStyleControls } from "../ui/style-controls.js";
import { createPropertyActions } from "../editor/property-actions.js";
import { createLaunchController } from "./launch-controller.js";
import { bindPageNavigation } from "../ui/page-navigation.js";
import {
  bindWorkspaceControls,
  observeViewport,
} from "../ui/workspace-bindings.js";
import { createSelectionController } from "../editor/selection-controller.js";
import { createToolController } from "../editor/tool-controller.js";
import { createPersistenceController } from "./persistence-controller.js";
import { createEditController } from "./edit-controller.js";
import { createSelectionMenu } from "../ui/selection-menu.js";
import { createPageActions } from "../editor/page-actions.js";
import { createFileController } from "./file-controller.js";

import { createNewDocumentController } from "./new-document-controller.js";

import { createBlockImportController } from "./block-import-controller.js";
import { createStampController } from "./stamp-controller.js";
import { bindPropertyControls } from "../ui/property-bindings.js";
import { createSelectionActions } from "../editor/selection-actions.js";
import { createPointerController } from "../input/pointer-controller.js";
import { createCreationController } from "../editor/create-tool-controller.js";
import { createSnapController } from "../input/snap-controller.js";
import { createDocumentController } from "./document-controller.js";
import { createPdfViewport } from "../rendering/pdf-viewport.js";
import { createCommandController } from "../editor/command-controller.js";
import { createTransformController } from "../editor/transform-controller.js";
import { createCommandPrompt } from "../ui/command-prompt.js";
import { createEditToolDefinitions } from "../editor/edit-tool-definitions.js";
import { createDialogs } from "../ui/dialogs.js";
import { createFeedback } from "../ui/feedback.js";
import { createWorkspacePresenter } from "../ui/workspace-presenter.js";
import { createOverlayRenderer } from "../rendering/overlay-renderer.js";
import { createAnnotationRenderer } from "../rendering/annotation-renderer.js";

import { createToolbar } from "../ui/toolbar.js";

import { createDetailRenderer } from "../pdf-detail.js";
import { setupPWA } from "../pwa.js";

import { initializeLiraShell } from "../lira-shell.js";

import { createTracker } from "../drawing-aids.js";

import { writeSaved } from "../storage.js";

export function createPdfApplication() {
  const { session, workspace, interaction } = createWorkspaceState();
  let objectMenu;
  const closeObjectMenu = () => objectMenu?.close();

  let quickToolBar;
  const updateQuickTools = () => quickToolBar?.updateActive();

  const pdfDetail = createDetailRenderer(document.getElementById("sheet"));

  const { transformTools, editTypes, editPhase } = createEditToolDefinitions(
    {},
  );
  const tracker = createTracker();

  const $ = (id) => document.getElementById(id),
    NS = "http://www.w3.org/2000/svg";
  const shell = initializeLiraShell({
    document,
    showPage: (page) => showPage(page),
    canNavigate: () => !workspace.busy && !interaction.pendingDialog,
  });

  const documents = [];

  const clone = (value) => structuredClone(value);
  const { displayState, current, pageEntities, scaleContext } =
    createDocumentSelectors({ session, workspace, interaction });
  const { toast, error } = createFeedback({ $: (...args) => $(...args) });
  const persistence = createPersistenceController({
    workspace,
    documents,
    stashDocument: () => stashDocument(),
    writeSaved,
    status: (text) => {
      $("saveStatus").textContent = text;
    },
    notify: (text) => toast(text),
    canUpdate: () =>
      !workspace.busy &&
      !workspace.restoring &&
      !interaction.pendingDialog &&
      !interaction.drag &&
      !interaction.points.length &&
      !interaction.editOperation &&
      !interaction.activeGrip &&
      !document.querySelector("dialog[open]"),
  });
  const autosave = persistence.autosave;
  const { commit, history } = createEditController({
    session,
    workspace,
    interaction,
    updateChanges: () => documentTabsUI.updateChanges(),
    refresh: (...args) => refresh(...args),
    autosave: () => autosave(),
    showPage: (...args) => showPage(...args),
    view: () => view(),
    closeObjectMenu,
    clearTracking: (...args) => clearTracking(...args),
  });
  const { ask, canvasText } = createDialogs({
    $: (...args) => $(...args),
    interaction,
    setTool: (...args) => setTool(...args),
    paint: (...args) => paint(...args),
  });
  const { setTool, cancel } = createToolController({
    presentTool: (...args) => styleControls.presentTool(...args),
    closeObjectMenu: (...args) => closeObjectMenu(...args),
    interaction,
    workspace,
    transformTools,
    editTypes: (...args) => editTypes(...args),
    session,
    editPhase: (...args) => editPhase(...args),
    clearTracking: (...args) => clearTracking(...args),
    showCategory: (...args) => showCategory(...args),
    rememberStyle: (...args) => styleControls.remember(...args),
    restoreStyle: (...args) => styleControls.restore(...args),
    showProperties: () => shell.showProperties(),
    refresh: (...args) => refresh(...args),
  });
  const toolbar = createToolbar({
    document,
    canInteract: () => !workspace.busy && !interaction.pendingDialog,
    activate: (id) =>
      id === "block"
        ? library.open()
        : setTool(id === "circle" ? $("circleShape").value : id),
  });
  const showCategory = toolbar.showCategory;
  const { prompt } = createCommandPrompt({
    current: (...args) => current(...args),
    session,
    workspace,
    scaleContext: (...args) => scaleContext(...args),
    interaction,
    $: (...args) => $(...args),
  });
  const { svg, prepareMarkupPreviews, drawEntity, releaseDocument } =
    createAnnotationRenderer({
      $: (...args) => $(...args),
      document,
      NS,
      workspace,
      session,
      interaction,
      displayState,
    });
  const styleControls = createStyleControls($);
  const style = styleControls.read;
  const { paint } = createOverlayRenderer({
    workspace,
    $: (...args) => $(...args),
    interaction,
    drawEntity: (...args) => drawEntity(...args),
    svg: (...args) => svg(...args),
    pdfLineAt: (...args) => pdfLineAt(...args),
    pageEntities: (...args) => pageEntities(...args),
    editedEntities: (...args) => editedEntities(...args),
    style: (...args) => style(...args),
    scaleContext: (...args) => scaleContext(...args),
  });
  const { refresh } = createWorkspacePresenter({
    updateQuickTools: (...args) => updateQuickTools(...args),
    shell,
    workspace,
    interaction,
    $: (...args) => $(...args),
    current: (...args) => current(...args),
    session,
    prompt: (...args) => prompt(...args),
    paint: (...args) => paint(...args),
    document,
  });
  const { select } = createSelectionController({
    presentSelection: (...args) => styleControls.presentSelection(...args),
    interaction,
    session,
    current: (...args) => current(...args),
    refresh: (...args) => refresh(...args),
    showProperties: () => shell.showProperties(),
  });
  const {
    displayedPage,
    documentScroll,
    scrollbars,
    view,
    fit,
    fitAll,
    zoomAt,
    scrollMetrics,
  } = createPdfViewport({
    workspace,
    session,
    $: (...args) => $(...args),
    error: (...args) => error(...args),
    drawEntity: (...args) => drawEntity(...args),
    interaction,
    scrollToPosition: (...args) => scrollToPosition(...args),
    pdfDetail,
    paint: (...args) => paint(...args),
  });
  const pageRenderer = createPageRenderer({
    canvas: $("pdfcanvas"),
    sheet: $("sheet"),
    overlay: $("overlay"),
    pdfDetail,
  });
  const { showPage } = createPageController({
    workspace,
    interaction,
    session,
    renderer: pageRenderer,
    closeObjectMenu,
    clearTracking: (...args) => clearTracking(...args),
    prepareMarkupPreviews,
    presentPage: (...args) => presentPage(...args),
    refresh: () => refresh(),
    view,
    fit,
    refreshLibrary: () => library.refresh(),
    autosave,
    error,
  });
  const { presentPage } = bindPageNavigation({
    $: (...args) => $(...args),
    workspace,
    showPage: (...args) => showPage(...args),
  });
  const documentPresentation = createDocumentPresentation({
    $,
    getDocuments: () => documents,
    getActiveId: () => workspace.activeId,
    isChanged: (...args) => documentController.isChanged(...args),
    activate: (...args) => activateDocument(...args),
    close: (id) => closeDocument(id).catch(error),
    reorder: (...args) => documentController.reorder(...args),
  });
  const documentTabsUI = documentPresentation.tabs;
  const documentController = createDocumentController({
    documents,
    workspace,
    interaction,
    session,
    services: {
      loadPdf,
      readEditablePdf,
      saveEditablePdf,
      choosePdfTarget,
      writePdfFile,
      download,
    },
    presentation: documentPresentation,
    rendering: {
      clear: async () => {
        documentScroll.clear();
        await pageRenderer.cancel();
      },
      updateScrollbars: () => scrollbars.update(),
    },
    error,
    autosave,
    showPage,
    clone,
    toast,
    refresh: () => refresh(),
    releaseDocument,
  });
  const {
    stashDocument,
    activateDocument,
    openDocument,
    saveDocument,
    emptyWorkspace,
    closeDocument,
  } = documentController;
  const { pdfLineAt, localPoint, clearTracking } = createSnapController({
    pageEntities: (...args) => pageEntities(...args),
    workspace,
    interaction,
    $: (...args) => $(...args),
    displayedPage: (...args) => displayedPage(...args),
    tracker,
    paint: (...args) => paint(...args),
  });
  const { addPoint } = createCreationController({
    stampText: () => $("stampPreset").value,
    interaction,
    toast: (...args) => toast(...args),
    workspace,
    scaleContext: (...args) => scaleContext(...args),
    refresh: (...args) => refresh(...args),
    clearTracking: (...args) => clearTracking(...args),
    clone: (...args) => clone(...args),
    ask: (...args) => ask(...args),
    session,
    style: (...args) => style(...args),
    commit: (...args) => commit(...args),
    setTool: (...args) => setTool(...args),
    select: (...args) => select(...args),
    canvasText: (...args) => canvasText(...args),
    error: (...args) => error(...args),
  });
  const contentActions = createPdfContentActions({
    interaction,
    workspace,
    session,
    clone,
    style,
    scaleContext,
    commit,
    setTool,
    select,
    toast,
    error,
    pdfLineAt,
  });
  const { scrollToPosition, scrollDocument } = createViewportNavigation({
    workspace,
    interaction,
    documentScroll,
    showPage,
    view,
    $,
    scrollMetrics,
    zoomAt,
  });
  createPointerController({
    contentActions,
    $: (...args) => $(...args),
    workspace,
    interaction,
    documentScroll,
    showPage: (...args) => showPage(...args),
    localPoint: (...args) => localPoint(...args),
    style: (...args) => style(...args),
    scaleContext: (...args) => scaleContext(...args),
    paint: (...args) => paint(...args),
    applyGrip: (...args) => applyGrip(...args),
    error: (...args) => error(...args),
    clone: (...args) => clone(...args),
    session,
    commit: (...args) => commit(...args),
    select: (...args) => select(...args),
    toast: (...args) => toast(...args),
    editTypes: (...args) => editTypes(...args),
    refresh: (...args) => refresh(...args),
    advancedPick: (...args) => advancedPick(...args),
    editPoint: (...args) => editPoint(...args),
    addPoint: (...args) => addPoint(...args),
    tracker,
    view: (...args) => view(...args),
    current: (...args) => current(...args),
    prompt: (...args) => prompt(...args),
    pageEntities: (...args) => pageEntities(...args),
    document,
  });
  const { editText, remove, changeGrouping, copyBlock } =
    createSelectionActions({
      current: (...args) => current(...args),
      canvasText: (...args) => canvasText(...args),
      toast: (...args) => toast(...args),
      clone: (...args) => clone(...args),
      session,
      commit: (...args) => commit(...args),
      interaction,
      workspace,
      error,
      setTool: (...args) => setTool(...args),
    });
  const editProperties = createPropertyActions({
    session,
    interaction,
    commit,
    canEdit: () =>
      !workspace.busy && !interaction.pendingDialog && !interaction.drag,
  });
  bindPropertyControls({
    $,
    style,
    interaction,
    editProperties,
    refresh,
    error,
    rememberStyle: styleControls.remember,
    canEdit: () =>
      !workspace.busy && !interaction.pendingDialog && !interaction.drag,
    copyBlock,
  });
  const { library } = createLibraryController({
    workspace,
    interaction,
    setTool: (...args) => setTool(...args),
    ask: (...args) => ask(...args),
    error: (...args) => error(...args),
    $: (...args) => $(...args),
    current: (...args) => current(...args),
    clone: (...args) => clone(...args),
    toast: (...args) => toast(...args),
  });
  createStampController({
    $: (...args) => $(...args),
    workspace,
    interaction,
    document,
    toast: (...args) => toast(...args),
    error: (...args) => error(...args),
    base64: (...args) => base64(...args),
    style: (...args) => style(...args),
    setTool: (...args) => setTool(...args),
  });
  createBlockImportController({
    $: (...args) => $(...args),
    workspace,
    interaction,
    ask: (...args) => ask(...args),
    document,
    base64: (...args) => base64(...args),
    style: (...args) => style(...args),
    library: {
      open: (...args) => library.open(...args),
      add: (...args) => library.add(...args),
      refresh: (...args) => library.refresh(...args),
    },
    toast: (...args) => toast(...args),
    error: (...args) => error(...args),
  });
  createNewDocumentController({
    $: (...args) => $(...args),
    workspace,
    interaction,
    openDocument: (...args) => openDocument(...args),
    error: (...args) => error(...args),
  });

  createFileController({
    $: (...args) => $(...args),
    workspace,
    interaction,
    openDocument: (...args) => openDocument(...args),
    error: (...args) => error(...args),
    stashDocument: (...args) => stashDocument(...args),
    documents,
    saveDocument: (...args) => saveDocument(...args),
    clone: (...args) => clone(...args),
    session,
    download: (...args) => download(...args),
    toast: (...args) => toast(...args),
  });
  bindWorkspaceControls({
    rotateCurrentPage: (...args) => rotateCurrentPage(...args),

    $: (...args) => $(...args),
    fit: (...args) => fit(...args),
    fitAll: (...args) => fitAll(...args),
    zoomAt: (...args) => zoomAt(...args),
    history: (...args) => history(...args),
    remove: (...args) => remove(...args),
    editText: (...args) => editText(...args),
    setTool: (...args) => setTool(...args),
    interaction,
    clearTracking: (...args) => clearTracking(...args),
    refresh: (...args) => refresh(...args),
    toast: (...args) => toast(...args),
  });
  const {
    advancedPick,
    editedEntities,
    operationScale,
    editPoint,
    editCommand,
  } = createTransformController({
    interaction,
    session,
    clone: (...args) => clone(...args),
    commit: (...args) => commit(...args),
    setTool: (...args) => setTool(...args),
    refresh: (...args) => refresh(...args),
    clearTracking: (...args) => clearTracking(...args),
    toast: (...args) => toast(...args),
    error: (...args) => error(...args),
    pageEntities: (...args) => pageEntities(...args),
    editTypes: (...args) => editTypes(...args),
    editPhase: (...args) => editPhase(...args),
  });
  const { recordCommand } = createCommandLog({
    document,
    log: $("lira-command-log"),
  });
  const { applyGrip, runCommand } = createCommandController({
    canRun: () =>
      !workspace.busy &&
      !interaction.pendingDialog &&
      !document.querySelector("dialog[open]"),
    recordCommand,
    clone: (...args) => clone(...args),
    session,
    interaction,
    commit: (...args) => commit(...args),
    refresh: (...args) => refresh(...args),
    workspace,
    error: (...args) => error(...args),
    setTool: (...args) => setTool(...args),
    scaleContext: (...args) => scaleContext(...args),
    operationScale: (...args) => operationScale(...args),
    editPoint: (...args) => editPoint(...args),
    addPoint: (...args) => addPoint(...args),
    editCommand: (...args) => editCommand(...args),
    toast: (...args) => toast(...args),
    library: {
      open: (...args) => library.open(...args),
      add: (...args) => library.add(...args),
      refresh: (...args) => library.refresh(...args),
    },
    history: (...args) => history(...args),
    fit: (...args) => fit(...args),
    fitAll: (...args) => fitAll(...args),
  });
  bindKeyboard({
    $,
    document,
    interaction,
    runCommand,
    history,
    remove,
    cancel,
    refresh,
  });
  observeViewport({
    viewport: $("viewport"),
    hasPage: () => !!workspace.viewport,
    fit,
  });

  ({ quickToolBar } = createQuickToolController({
    store: createQuickToolStore(),
    document,
    interaction,
    style: (...args) => style(...args),
    workspace,
    setTool: (...args) => setTool(...args),
    $: (...args) => $(...args),
    refresh: (...args) => refresh(...args),
    error: (...args) => error(...args),
  }));
  setupPWA(persistence.prepareUpdate);

  const { rotateCurrentPage } = createPageActions({
    workspace,
    interaction,
    setTool: (...args) => setTool(...args),
    clone: (...args) => clone(...args),
    session,
    commit: (...args) => commit(...args),
    fit: (...args) => fit(...args),
    toast: (...args) => toast(...args),
  });
  ({ objectMenu } = createSelectionMenu({
    workspace,
    interaction,
    session,
    $: (...args) => $(...args),
    document,
    setTool: (...args) => setTool(...args),
    select: (...args) => select(...args),
    changeGrouping: (...args) => changeGrouping(...args),
  }));

  const { startup } = createLaunchController({
    workspace,
    openDocument: (...args) => openDocument(...args),
    documents,
    activateDocument: (...args) => activateDocument(...args),
    emptyWorkspace: (...args) => emptyWorkspace(...args),
    autosave: (...args) => autosave(...args),
    error: (...args) => error(...args),
    interaction,
    document,
    toast: (...args) => toast(...args),
  });
  return { ready: startup };
}
