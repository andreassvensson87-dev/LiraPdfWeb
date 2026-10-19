const key = "lirapdf-quick-tools-v1";
export function createQuickToolStore({
  getStorage = () => globalThis.localStorage,
} = {}) {
  return {
    read: () => JSON.parse(getStorage().getItem(key)),
    write: (presets) => getStorage().setItem(key, JSON.stringify(presets)),
  };
}
