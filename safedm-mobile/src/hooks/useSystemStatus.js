import { useCallback, useEffect, useRef } from "react";
import { useUpdateStatus } from "../context/UpdateStatusContext";

export function useSystemStatus({ poll = false, intervalMs = 30000 } = {}) {
  const { setCanaryActive, clear } = useUpdateStatus();
  const timerRef = useRef(null);

  const check = useCallback(async () => {
    return null;
  }, []);

  useEffect(() => {
    if (!poll) return;
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      await check();
      timerRef.current = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll, intervalMs, check]);

  return { check, setCanaryActive, clear };
}
