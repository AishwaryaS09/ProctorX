/**
 * Central business-rule constants.
 * Kept in one place so the trust engine, controllers and validators stay in sync.
 * Values mirror the reference implementation.
 */
const TRUST_SCORE_START = 100;
const DEFAULT_EXAM_TITLE = 'Certified Software Engineering Assessment';
const DEFAULT_EXAM_DURATION_MIN = 60;

const RISK = {
  LOW: { min: 85, label: 'LOW', color: '#22c55e' },
  MEDIUM: { min: 60, label: 'MEDIUM', color: '#eab308' },
  HIGH: { min: 35, label: 'HIGH', color: '#f97316' },
  CRITICAL: { min: 0, label: 'CRITICAL', color: '#ef4444' },
};

const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

/** Points subtracted from the trust score for each violation type. */
const VIOLATION_POINTS = {
  FACE_ABSENT: 5,
  MULTIPLE_FACES: 10,
  LOOKING_AWAY: 3,
  TAB_CHANGED: 10,
  WINDOW_UNFOCUSED: 5,
  BROWSER_INACTIVE: 5,
  BROWSER_MINIMIZED: 5,
  FULLSCREEN_EXIT: 8,
};

/** Severity derived from points (>=10 HIGH, >=5 MEDIUM, else LOW). */
function severityFor(points) {
  if (points >= 10) return SEVERITY.HIGH;
  if (points >= 5) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
}

/**
 * Map a detected face state to a violation type (null = not a violation).
 * Only the three monitored violation states deduct trust. ERROR means the
 * frame could not be analysed (not evidence of absence), so it never maps to
 * a violation and no trust is deducted for a decode/analysis failure.
 */
const FACE_STATE_TO_VIOLATION = {
  ABSENT: 'FACE_ABSENT',
  MULTIPLE: 'MULTIPLE_FACES',
  LOOKING_AWAY: 'LOOKING_AWAY',
  PRESENT: null,
  ERROR: null,
};

/**
 * Map a face state to the ExamSession counter field it increments.
 * Exactly one counter is incremented per analysed frame (ERROR increments
 * none: it is a system state, not a face state). This is the single source
 * of truth used by recordFaceEvent, the dashboard and the session summary.
 */
const FACE_STATUS_COUNTER = {
  PRESENT: 'facePresentCount',
  ABSENT: 'faceAbsentCount',
  MULTIPLE: 'faceMultipleCount',
  LOOKING_AWAY: 'faceLookingAwayCount',
  ERROR: null,
};

/** Map browser status/event strings to a violation type (null = benign). */
function browserViolationFor(status, eventName) {
  const key = status || eventName;
  switch (key) {
    case 'tab_hidden':
    case 'TAB_CHANGED':
      return 'TAB_CHANGED';
    case 'window_blur':
    case 'WINDOW_UNFOCUSED':
      return 'WINDOW_UNFOCUSED';
    case 'minimized':
    case 'BROWSER_MINIMIZED':
      return 'BROWSER_MINIMIZED';
    case 'fullscreen_exit':
    case 'FULLSCREEN_EXIT':
      return 'FULLSCREEN_EXIT';
    case 'inactive':
    case 'BROWSER_INACTIVE':
      return 'BROWSER_INACTIVE';
    case 'tab_visible':
    case 'active':
    case 'ACTIVE':
    default:
      return null;
  }
}

const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
};

const ROLES = {
  CANDIDATE: 'candidate',
  ADMIN: 'admin',
};

/** Warning messages surfaced to candidates at each cumulative violation count. */
const WARNING_MESSAGES = {
  1: 'First warning: suspicious activity detected.',
  2: 'Second warning: repeated suspicious activity detected.',
  3: 'Critical warning: your exam may be terminated.',
};

const SEVERITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 };

module.exports = {
  TRUST_SCORE_START,
  DEFAULT_EXAM_TITLE,
  DEFAULT_EXAM_DURATION_MIN,
  RISK,
  SEVERITY,
  VIOLATION_POINTS,
  severityFor,
  FACE_STATE_TO_VIOLATION,
  FACE_STATUS_COUNTER,
  browserViolationFor,
  SESSION_STATUS,
  ROLES,
  WARNING_MESSAGES,
  SEVERITY_RANK,
};
