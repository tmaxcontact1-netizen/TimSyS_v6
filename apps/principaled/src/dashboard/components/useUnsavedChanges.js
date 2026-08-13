import { useEffect } from "react";

export default function useUnsavedChanges(isDirty) {
  useEffect(() => {
    const beforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.dispatchEvent(
      new CustomEvent("principaled:dirty-state", { detail: Boolean(isDirty) }),
    );
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (isDirty)
        window.dispatchEvent(
          new CustomEvent("principaled:dirty-state", { detail: false }),
        );
    };
  }, [isDirty]);
}
