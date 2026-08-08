export const RISK_STYLES = {
  LOW: { badge: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20', bar: 'bg-emerald-500', label: 'Low' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-700 ring-amber-600/20', bar: 'bg-amber-500', label: 'Medium' },
  HIGH: { badge: 'bg-orange-100 text-orange-700 ring-orange-600/20', bar: 'bg-orange-500', label: 'High' },
  CRITICAL: { badge: 'bg-red-100 text-red-700 ring-red-600/20', bar: 'bg-red-500', label: 'Critical' },
};

export const SEVERITY_STYLES = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  MEDIUM: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  HIGH: 'bg-red-100 text-red-700 ring-red-600/20',
};

export const STATUS_STYLES = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  COMPLETED: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  ABANDONED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export const EXAM_DURATION_MINUTES = 60;

export const EXAM_INSTRUCTIONS = [
  'Ensure only one person is visible.',
  'Keep your face inside the camera frame.',
  'Maintain fullscreen throughout the exam.',
  'Do not switch browser tabs.',
  'Do not minimize the browser.',
  'Keep the camera enabled.',
  'A stable internet connection is required.',
  'Violations reduce your trust score.',
  'Excessive violations automatically end the exam.',
];

export const VIOLATION_META = {
  FACE_ABSENT: { label: 'Face Absent', points: 5 },
  MULTIPLE_FACES: { label: 'Multiple Faces', points: 10 },
  LOOKING_AWAY: { label: 'Looking Away', points: 3 },
  TAB_CHANGED: { label: 'Tab Changed', points: 10 },
  WINDOW_UNFOCUSED: { label: 'Window Unfocused', points: 5 },
  BROWSER_INACTIVE: { label: 'Browser Inactive', points: 5 },
  BROWSER_MINIMIZED: { label: 'Browser Minimized', points: 5 },
  FULLSCREEN_EXIT: { label: 'Fullscreen Exited', points: 8 },
};

export const FACE_STATUS_META = {
  PRESENT: { label: 'Present', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
  ABSENT: { label: 'Absent', badge: 'bg-red-100 text-red-700 ring-red-600/20' },
  MULTIPLE: { label: 'Multiple Faces', badge: 'bg-orange-100 text-orange-700 ring-orange-600/20' },
  LOOKING_AWAY: { label: 'Looking Away', badge: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
  ERROR: { label: 'Error', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};
