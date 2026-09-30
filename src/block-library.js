import { readBlockLibrary, writeBlockLibrary } from "./storage.js";
export function blockLibrary({ place, canPlace, rename, error }) {
  const $ = (id) => document.getElementById(id),
    dialog = $("blockLibrary");
  let blocks = [],
    working = false;
  function render() {
    const words = $("blockSearch")
      .value.toLocaleLowerCase("sv-SE")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const matches = blocks.filter((b) =>
      words.every((w) => b.blockName.toLocaleLowerCase("sv-SE").includes(w)),
    );
    $("blockLibraryCount").textContent =
      `${matches.length} av ${blocks.length} block`;
    $("blockLibraryGrid").replaceChildren();
    for (const b of matches) {
      const card = document.createElement("article");
      card.className = "block-card";
      const button = document.createElement("button");
      button.className = "block-choice";
      button.disabled = !canPlace();
      button.setAttribute("aria-label", `Placera ${b.blockName}`);
      const img = document.createElement("img");
      img.src = b.preview;
      img.alt = "";
      img.loading = "lazy";
      const label = document.createElement("strong");
      label.textContent = b.blockName;
      button.title = b.blockName;
      button.append(img, label);
      button.onclick = () => {
        if (working || !canPlace()) return;
        dialog.close();
        place(structuredClone(b));
      };
      const edit = document.createElement("button");
      edit.className = "block-rename";
      edit.textContent = "Byt namn";
      edit.setAttribute("aria-label", `Byt namn på ${b.blockName}`);
      edit.onclick = async () => {
        if (working) return;
        working = true;
        try {
          const name = await rename(b.blockName);
          if (!name?.trim()) return;
          const next = blocks.map((x) =>
            x.libraryId === b.libraryId ? { ...x, blockName: name.trim() } : x,
          );
          await writeBlockLibrary(next);
          blocks = next;
          render();
        } catch (e) {
          error(e);
        } finally {
          working = false;
        }
      };
      card.append(button, edit);
      $("blockLibraryGrid").append(card);
    }
    $("blockLibraryEmpty").hidden = matches.length > 0;
    $("blockLibraryEmpty").textContent = blocks.length
      ? "Inga block matchar sökningen."
      : "Importera en PDF för att skapa ditt första block.";
    $("blockLibraryHint").textContent = canPlace()
      ? "Välj ett block och klicka i ritningen för att placera det."
      : "Öppna ett dokument för att placera block. Du kan importera till biblioteket här.";
  }
  $("blockSearch").oninput = render;
  $("closeBlockLibrary").onclick = () => dialog.close();
  $("importLibraryBlock").onclick = () => {
    if (!working) $("blockInput").click();
  };
  return {
    refresh() {
      if (dialog.open) render();
    },
    async open() {
      if (working) return;
      try {
        working = true;
        blocks = await readBlockLibrary();
        $("blockSearch").value = "";
        render();
        if (!dialog.open) dialog.showModal();
        $("blockSearch").focus();
      } catch (e) {
        error(e);
      } finally {
        working = false;
      }
    },
    async add(block) {
      if (working) throw Error("Vänta tills biblioteket är klart.");
      working = true;
      try {
        const { id, page, points, libraryId, ...asset } = block;
        const latest = await readBlockLibrary();
        const next = [...latest, { ...asset, libraryId: crypto.randomUUID() }];
        await writeBlockLibrary(next);
        blocks = next;
        $("blockSearch").value = "";
        render();
      } finally {
        working = false;
      }
    },
  };
}
