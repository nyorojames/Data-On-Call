import { PlayerLevel, PlayerGoal } from './rules.ts';

export interface TelemetryRow {
  session_id: string;
  scene_no: number;
  level: number;
  goal: number;
  prev_hints_used: number;
  prev_risky_count: number;
  prev_timeout_count: number;
  prev_decision_time_sec: number;
  hint_used_this_scene: number;
  decision_time_sec: number;
  chose_risky: number;
  source: 'real' | 'synthetic';
}

export const CSV_HEADERS = [
  'session_id',
  'scene_no',
  'level',
  'goal',
  'prev_hints_used',
  'prev_risky_count',
  'prev_timeout_count',
  'prev_decision_time_sec',
  'hint_used_this_scene',
  'decision_time_sec',
  'chose_risky',
  'source',
] as const;

export function mapLevelToCode(level: PlayerLevel): number {
  return level === 'Beginner' ? 0 : 1;
}

export function mapGoalToCode(goal: PlayerGoal): number {
  switch (goal) {
    case 'Internship prep':
      return 0;
    case 'Keep up with trends':
      return 1;
    case 'Use AI effectively':
      return 2;
    default:
      return 0;
  }
}

/**
 * Generate a random session ID with crypto.getRandomValues (hex string)
 * and a safe fallback if crypto is unavailable.
 * Contains nothing derived from the device, IP, time zone, or user.
 */
export function generateSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

export function buildTelemetryRow(params: {
  sessionId: string;
  sceneNumber: number;
  level: PlayerLevel;
  goal: PlayerGoal;
  previousHintsCount: number;
  previousRiskyCount: number;
  previousTimeoutsCount: number;
  previousDecisionTimeSec: number;
  hintViewedInThisScene: boolean;
  decisionTimeSec: number;
  isRiskyChoiceOrTimeout: boolean;
  source?: 'real' | 'synthetic';
}): TelemetryRow {
  return {
    session_id: params.sessionId,
    scene_no: params.sceneNumber,
    level: mapLevelToCode(params.level),
    goal: mapGoalToCode(params.goal),
    prev_hints_used: params.previousHintsCount,
    prev_risky_count: params.previousRiskyCount,
    prev_timeout_count: params.previousTimeoutsCount,
    prev_decision_time_sec: Math.round(params.previousDecisionTimeSec * 100) / 100,
    hint_used_this_scene: params.hintViewedInThisScene ? 1 : 0,
    decision_time_sec: Math.round(params.decisionTimeSec * 100) / 100,
    chose_risky: params.isRiskyChoiceOrTimeout ? 1 : 0,
    source: params.source || 'real',
  };
}

export function formatCsvRow(row: TelemetryRow): string {
  return [
    row.session_id,
    row.scene_no,
    row.level,
    row.goal,
    row.prev_hints_used,
    row.prev_risky_count,
    row.prev_timeout_count,
    row.prev_decision_time_sec,
    row.hint_used_this_scene,
    row.decision_time_sec,
    row.chose_risky,
    row.source,
  ].join(',');
}

export function formatCsvFile(rows: TelemetryRow[]): string {
  const header = CSV_HEADERS.join(',');
  if (rows.length === 0) return `${header}\n`;
  const data = rows.map(formatCsvRow).join('\n');
  return `${header}\n${data}\n`;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  row?: TelemetryRow;
}

const HEX_REGEX = /^[a-f0-9]{16,64}$/;

export function validateTelemetryPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Payload must be a non-null JSON object' };
  }

  const obj = payload as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Reject unexpected or missing keys (must exactly match the 12 columns)
  if (keys.length !== CSV_HEADERS.length) {
    return {
      valid: false,
      error: `Expected exactly 12 fields, received ${keys.length}`,
    };
  }

  for (const expectedKey of CSV_HEADERS) {
    if (!Object.prototype.hasOwnProperty.call(obj, expectedKey)) {
      return { valid: false, error: `Missing required field: ${expectedKey}` };
    }
  }

  // 1. session_id
  if (typeof obj.session_id !== 'string' || !HEX_REGEX.test(obj.session_id)) {
    return {
      valid: false,
      error: 'Field "session_id" must be a 16-64 hex character string without free text',
    };
  }

  // 2. scene_no (1..3)
  if (!Number.isInteger(obj.scene_no) || (obj.scene_no as number) < 1 || (obj.scene_no as number) > 3) {
    return { valid: false, error: 'Field "scene_no" must be an integer between 1 and 3' };
  }

  // 3. level (0 or 1)
  if (!Number.isInteger(obj.level) || ((obj.level as number) !== 0 && (obj.level as number) !== 1)) {
    return { valid: false, error: 'Field "level" must be 0 (Beginner) or 1 (Experienced)' };
  }

  // 4. goal (0, 1, or 2)
  if (
    !Number.isInteger(obj.goal) ||
    (obj.goal as number) < 0 ||
    (obj.goal as number) > 2
  ) {
    return { valid: false, error: 'Field "goal" must be an integer between 0 and 2' };
  }

  // 5. prev_hints_used (integer 0..3)
  if (
    !Number.isInteger(obj.prev_hints_used) ||
    (obj.prev_hints_used as number) < 0 ||
    (obj.prev_hints_used as number) > 3
  ) {
    return {
      valid: false,
      error: 'Field "prev_hints_used" must be an integer between 0 and 3',
    };
  }

  // 6. prev_risky_count (integer 0..3)
  if (
    !Number.isInteger(obj.prev_risky_count) ||
    (obj.prev_risky_count as number) < 0 ||
    (obj.prev_risky_count as number) > 3
  ) {
    return {
      valid: false,
      error: 'Field "prev_risky_count" must be an integer between 0 and 3',
    };
  }

  // 7. prev_timeout_count (integer 0..3)
  if (
    !Number.isInteger(obj.prev_timeout_count) ||
    (obj.prev_timeout_count as number) < 0 ||
    (obj.prev_timeout_count as number) > 3
  ) {
    return {
      valid: false,
      error: 'Field "prev_timeout_count" must be an integer between 0 and 3',
    };
  }

  // 8. prev_decision_time_sec (number >= 0, <= 600)
  if (
    typeof obj.prev_decision_time_sec !== 'number' ||
    !Number.isFinite(obj.prev_decision_time_sec) ||
    (obj.prev_decision_time_sec as number) < 0 ||
    (obj.prev_decision_time_sec as number) > 600
  ) {
    return {
      valid: false,
      error: 'Field "prev_decision_time_sec" must be a finite number between 0 and 600',
    };
  }

  // 9. hint_used_this_scene (0 or 1)
  if (
    !Number.isInteger(obj.hint_used_this_scene) ||
    ((obj.hint_used_this_scene as number) !== 0 && (obj.hint_used_this_scene as number) !== 1)
  ) {
    return { valid: false, error: 'Field "hint_used_this_scene" must be 0 or 1' };
  }

  // 10. decision_time_sec (number >= 0, <= 600)
  if (
    typeof obj.decision_time_sec !== 'number' ||
    !Number.isFinite(obj.decision_time_sec) ||
    (obj.decision_time_sec as number) < 0 ||
    (obj.decision_time_sec as number) > 600
  ) {
    return {
      valid: false,
      error: 'Field "decision_time_sec" must be a finite number between 0 and 600',
    };
  }

  // 11. chose_risky (0 or 1)
  if (
    !Number.isInteger(obj.chose_risky) ||
    ((obj.chose_risky as number) !== 0 && (obj.chose_risky as number) !== 1)
  ) {
    return { valid: false, error: 'Field "chose_risky" must be 0 or 1' };
  }

  // 12. source ("real" or "synthetic")
  if (obj.source !== 'real' && obj.source !== 'synthetic') {
    return { valid: false, error: 'Field "source" must be "real" or "synthetic"' };
  }

  return {
    valid: true,
    row: {
      session_id: obj.session_id as string,
      scene_no: obj.scene_no as number,
      level: obj.level as number,
      goal: obj.goal as number,
      prev_hints_used: obj.prev_hints_used as number,
      prev_risky_count: obj.prev_risky_count as number,
      prev_timeout_count: obj.prev_timeout_count as number,
      prev_decision_time_sec: obj.prev_decision_time_sec as number,
      hint_used_this_scene: obj.hint_used_this_scene as number,
      decision_time_sec: obj.decision_time_sec as number,
      chose_risky: obj.chose_risky as number,
      source: obj.source as 'real' | 'synthetic',
    },
  };
}
