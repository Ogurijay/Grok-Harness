import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export function isImeComposing(event: ReactKeyboardEvent): boolean {
  const native = event.nativeEvent;
  return Boolean(native.isComposing || event.key === "Process" || native.keyCode === 229);
}

/** Swallow Enter while IME is composing, and the leftover Enter Chromium fires after compositionend. */
export function useImeEnterGuard() {
  const lock = useRef(false);
  const raf = useRef(0);

  const arm = useCallback(() => {
    lock.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        lock.current = false;
        raf.current = 0;
      });
    });
  }, []);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const shouldHoldEnter = useCallback(
    (event: ReactKeyboardEvent) => {
      if (isImeComposing(event)) {
        if (event.key === "Enter") arm();
        return true;
      }
      if (event.key === "Enter" && lock.current) {
        event.preventDefault();
        lock.current = false;
        return true;
      }
      return false;
    },
    [arm],
  );

  return { shouldHoldEnter, onCompositionEnd: arm };
}
