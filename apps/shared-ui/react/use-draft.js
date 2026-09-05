import { useCallback, useEffect, useRef, useState } from "react";

export default function useDraft(key, initialValue, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const delay = options.delay ?? 300;
  const initial = useRef(initialValue);
  const [value, setValue] = useState(() => {
    try {
      const saved = storage?.getItem(key);
      return saved == null ? initialValue : JSON.parse(saved);
    } catch {
      return initialValue;
    }
  });
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        storage?.setItem(key, JSON.stringify(value));
        setSavedAt(new Date());
      } catch {
        // Storage may be unavailable; the in-memory draft still remains intact.
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, key, storage, value]);

  const clear = useCallback(() => {
    storage?.removeItem(key);
    setValue(initial.current);
    setSavedAt(null);
  }, [key, storage]);

  return { value, setValue, clear, savedAt, isDirty: JSON.stringify(value) !== JSON.stringify(initial.current) };
}
