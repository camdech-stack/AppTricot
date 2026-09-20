// In-memory-only session tracking state (see CLAUDE.md "Règles de
// session"): never persisted, on purpose. `liveSessionId` is the session
// this browser context currently considers open; the "stopped by hand"
// flag remembers which target was manually paused so a counter tap on it
// doesn't silently restart the chrono. Both reset when the app leaves the
// foreground, per the spec.
export interface SessionTarget {
  projectId: string | null
}

function isSameTarget(a: SessionTarget, b: SessionTarget): boolean {
  return a.projectId === b.projectId
}

let liveSessionId: string | null = null
let manualStopTarget: SessionTarget | null = null

export function getLiveSessionId(): string | null {
  return liveSessionId
}

export function setLiveSessionId(id: string | null): void {
  liveSessionId = id
}

export function getManualStopTarget(): SessionTarget | null {
  return manualStopTarget
}

export function isManuallyStoppedFor(target: SessionTarget): boolean {
  return manualStopTarget != null && isSameTarget(manualStopTarget, target)
}

export function setManualStopTarget(target: SessionTarget): void {
  manualStopTarget = target
}

// Clears the flag only if it belongs to a different target than the one
// tapped — a tap on the same target must not clear it (that's the whole
// point of the "no auto-restart after a manual stop" rule).
export function clearManualStopIfDifferentTarget(target: SessionTarget): void {
  if (manualStopTarget && !isSameTarget(manualStopTarget, target)) {
    manualStopTarget = null
  }
}

export function clearManualStopTarget(): void {
  manualStopTarget = null
}

// Called whenever the app leaves the foreground: both pieces of state are
// meaningless once the current in-memory context is gone.
export function resetForegroundState(): void {
  liveSessionId = null
  manualStopTarget = null
}

export { isSameTarget }
