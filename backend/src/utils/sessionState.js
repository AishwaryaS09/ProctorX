/**
 * Snapshot helpers for live session counters.
 * Single source of truth shared by the trust engine, event service,
 * monitor controller and exam controller so every channel (REST + socket)
 * reports identical counters.
 */
function counterState(session) {
  return {
    facePresent: session.facePresentCount || 0,
    faceAbsent: session.faceAbsentCount || 0,
    faceMultiple: session.faceMultipleCount || 0,
    lookingAway: session.faceLookingAwayCount || 0,
    browserViolations: session.browserViolationCount || 0,
    fullscreenExits: session.fullscreenExitCount || 0,
    warnings: session.warningLevel || 0,
    violations: session.violationCount || 0,
  };
}

/**
 * Trust/risk/violation snapshot + counters, pushed on every live update.
 */
function liveState(session) {
  return {
    trustScore: session.trustScore,
    riskLevel: session.currentRisk,
    violationCount: session.violationCount,
    warningLevel: session.warningLevel,
    counters: counterState(session),
  };
}

module.exports = { counterState, liveState };
