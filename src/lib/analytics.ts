// Minimal analytics helpers (can be wired to Firebase Analytics/PostHog later)

type TimerHandle = { start: number };

export function startTimer(): TimerHandle {
  return { start: performance.now() };
}

export function endTimerMs(handle: TimerHandle): number {
  return Math.max(0, performance.now() - handle.start);
}

export const metrics = {
  recordScanSuccess(seconds: number) {
    try { console.debug('[analytics] scan_success_s', seconds); } catch {}
  },
  recordEditRate(rate: number) {
    try { console.debug('[analytics] edit_rate', rate); } catch {}
  },
  recordTimeToParsed(ms: number) {
    try { console.debug('[analytics] time_to_parsed_ms', ms); } catch {}
  },
  recordExportUse(preset: string) {
    try { console.debug('[analytics] export_use', preset); } catch {}
  },
};


