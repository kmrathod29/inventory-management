import { useEffect, useRef } from "react";

export function useDataChanged(onChange) {
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!window.app?.onDataChanged) return undefined;
    return window.app.onDataChanged(() => {
      Promise.resolve(callbackRef.current()).catch(() => {
        // Silently ignore errors in data change callbacks to avoid console spam
      });
    });
  }, []);
}
