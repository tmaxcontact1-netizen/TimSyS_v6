export const PAGE_SIZE = 50;
export const rowNumber = (page, index, pageSize = PAGE_SIZE) =>
  (Math.max(1, page) - 1) * pageSize + index + 1;

export function protectUnsavedChanges(isDirty) {
  const handler = (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}

export function standardNavigation({ home = "#overview" } = {}) {
  return {
    back() { history.length > 1 ? history.back() : location.assign(home); },
    returnToLauncher() { window.close(); }
  };
}
