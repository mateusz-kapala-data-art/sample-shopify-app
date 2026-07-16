import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

// Poll the current route's loader on an interval so external changes — webhook-driven
// updates, a new install, a re-sync — appear on the open page without a manual reload
// (seamless + instant). Idle-guarded so revalidations never overlap, and paused while the
// tab is hidden so we don't hammer the server when the app isn't on screen. Returns the
// revalidator so callers can show a quiet "updating…" hint.
export function useAutoRevalidate(intervalMs: number) {
  const revalidator = useRevalidator();
  const ref = useRef(revalidator);
  ref.current = revalidator;

  useEffect(() => {
    const id = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        ref.current.state === "idle"
      ) {
        ref.current.revalidate();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return revalidator;
}
