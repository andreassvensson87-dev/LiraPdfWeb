import { readBlockLibrary, writeBlockLibrary } from "../storage.js";
import { blockLibrary } from "../block-library.js";

export function createLibraryController({
  workspace,
  interaction,
  setTool,
  ask,
  error,
  $,
  current,
  clone,
  toast,
}) {
  const library = blockLibrary({
    readBlocks: readBlockLibrary,
    writeBlocks: writeBlockLibrary,
    canPlace: () => !!workspace.pdf && !workspace.busy,
    place: (block) => {
      interaction.pendingBlock = block;
      delete interaction.pendingBlock.libraryId;
      setTool("block");
    },
    rename: (name) => ask("Byt namn på block", "Namn i biblioteket", name),
    error,
  });
  $("saveLibraryBlock").onclick = async () => {
    const block = current();
    if (block?.type !== "block" || workspace.busy || interaction.pendingDialog)
      return;
    try {
      const name = await ask(
        "Spara i blockbibliotek",
        "Ange ett namn för blocket.",
        block.blockName || "PDF-block",
      );
      if (!name?.trim()) return;
      await library.add({ ...clone(block), blockName: name.trim() });
      toast(
        "Blocket är sparat i biblioteket och kan användas i andra dokument.",
      );
    } catch (e) {
      error(e);
    }
  };

  return { library };
}
