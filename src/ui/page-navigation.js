export function bindPageNavigation({ $, workspace, showPage }) {
  $("prevPage").onclick = () => {
    if (!workspace.busy) showPage(workspace.pageNo - 1);
  };
  $("nextPage").onclick = () => {
    if (!workspace.busy) showPage(workspace.pageNo + 1);
  };
  $("pageNumber").onchange = () => {
    const n = Number($("pageNumber").value);
    if (
      workspace.pdf &&
      !workspace.busy &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= workspace.pdf.numPages
    )
      showPage(n);
    else $("pageNumber").value = workspace.pageNo;
  };
  function presentPage(number, count) {
    $("pageLabel").textContent = `Sida ${number} av ${count}`;
    $("pageNumber").value = number;
    $("pageNumber").max = count;
    $("pageTotal").textContent = `av ${count}`;
    $("prevPage").disabled = number === 1;
    $("nextPage").disabled = number === count;
  }
  return { presentPage };
}
