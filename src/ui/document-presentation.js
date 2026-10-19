import { documentTabs } from "../document-tabs.js";

// DOM owner for document tabs, save status and the unsaved-document dialog.
export function createDocumentPresentation({
  $,
  getDocuments,
  getActiveId,
  isChanged,
  activate,
  close,
  reorder,
}) {
  const tabs = documentTabs({
    getDocuments,
    getActiveId,
    isChanged,
    activate,
    close,
    reorder,
  });
  function presentDocument(name) {
    $("filename").textContent = name;
    $("sheet").hidden = false;
    $("emptyWorkspace").hidden = true;
    $("pageNumber").disabled = false;
  }
  function presentEmpty() {
    $("sheet").hidden = true;
    $("overlay").replaceChildren();
    $("emptyWorkspace").hidden = false;
    $("filename").textContent = $("pageLabel").textContent = "Inget dokument";
    $("pageNumber").value = 0;
    $("pageTotal").textContent = "/ 0";
    for (const id of ["prevPage", "nextPage", "pageNumber"])
      $(id).disabled = true;
  }
  async function confirmClose(name) {
    $("closeDocumentName").textContent = name;
    const dialog = $("closeDocumentDialog");
    dialog.returnValue = "cancel";
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue), {
        once: true,
      });
      dialog.showModal();
    });
  }
  $("emptyOpen").onclick = () => $("open").click();
  return {
    tabs,
    presentDocument,
    presentEmpty,
    confirmClose,
    status: (text) => {
      $("saveStatus").textContent = text;
    },
    saving: (active) => {
      $("save").disabled = $("saveAs").disabled = active;
    },
    canClose: () => !$("closeDocumentDialog").open && !$("export").disabled,
    render: (options) => tabs.render(options),
  };
}
