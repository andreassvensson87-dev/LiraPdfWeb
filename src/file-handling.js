// OS launches may arrive during startup or while another document is opening.
export function setupFileHandling({
  launchQueue = globalThis.launchQueue,
  ready = Promise.resolve(),
  canOpen,
  open,
  error,
  waiting = () => {},
  wait = () => new Promise((resolve) => setTimeout(resolve, 200)),
}) {
  if (!launchQueue?.setConsumer) return false;
  let queue = Promise.resolve();
  launchQueue.setConsumer(({ files = [] }) => {
    const handles = [...files];
    queue = queue
      .then(async () => {
        await ready;
        for (const handle of handles) {
          try {
            const file = await handle.getFile();
            if (!/\.pdf$/i.test(file.name))
              throw Error("LiraPDF kan öppna PDF-filer från Utforskaren.");
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!canOpen()) waiting();
            while (!canOpen()) await wait();
            await open(bytes, file.name);
          } catch (e) {
            error(e);
          }
        }
      })
      .catch(error);
    return queue;
  });
  return true;
}
