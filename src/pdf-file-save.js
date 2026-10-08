export const pdfFilename = (name) =>
  name.replace(/\.(pdf|lirapdf)$/i, "") + ".pdf";

export async function choosePdfTarget(
  handle,
  name,
  saveAs = false,
  picker = globalThis.showSaveFilePicker,
) {
  if (saveAs || !handle) {
    if (!picker) return null;
    handle = await picker.call(globalThis, {
      suggestedName: pdfFilename(name),
      types: [
        {
          description: "PDF-dokument",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });
  }
  if (
    handle.queryPermission &&
    (await handle.queryPermission({ mode: "readwrite" })) !== "granted"
  ) {
    if ((await handle.requestPermission({ mode: "readwrite" })) !== "granted")
      throw Error(
        "LiraPDF behöver skrivrättighet för att spara till PDF-filen.",
      );
  }
  return handle;
}

export async function writePdfFile(handle, bytes) {
  const stream = await handle.createWritable();
  try {
    await stream.write(bytes);
    await stream.close();
  } catch (error) {
    await stream.abort?.().catch(() => {});
    throw error;
  }
}

export function persistableFileHandle(handle) {
  return typeof globalThis.FileSystemFileHandle !== "undefined" &&
    handle instanceof globalThis.FileSystemFileHandle
    ? handle
    : null;
}
