import { PlayerLevel, PlayerGoal } from './rules.ts';

export interface TelemetryRow {
  oturum: string;
  sahne_no: number;
  seviye: number;
  hedef: number;
  onceki_ipucu_sayisi: number;
  onceki_riskli_sayisi: number;
  onceki_timeout_sayisi: number;
  onceki_karar_suresi_sn: number;
  ipucu_bu_sahne: number;
  karar_suresi_sn: number;
  secim_riskli: number;
  kaynak: 'gercek';
}

export const CSV_HEADERS = [
  'oturum',
  'sahne_no',
  'seviye',
  'hedef',
  'onceki_ipucu_sayisi',
  'onceki_riskli_sayisi',
  'onceki_timeout_sayisi',
  'onceki_karar_suresi_sn',
  'ipucu_bu_sahne',
  'karar_suresi_sn',
  'secim_riskli',
  'kaynak',
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
}): TelemetryRow {
  return {
    oturum: params.sessionId,
    sahne_no: params.sceneNumber,
    seviye: mapLevelToCode(params.level),
    hedef: mapGoalToCode(params.goal),
    onceki_ipucu_sayisi: params.previousHintsCount,
    onceki_riskli_sayisi: params.previousRiskyCount,
    onceki_timeout_sayisi: params.previousTimeoutsCount,
    onceki_karar_suresi_sn: Math.round(params.previousDecisionTimeSec * 100) / 100,
    ipucu_bu_sahne: params.hintViewedInThisScene ? 1 : 0,
    karar_suresi_sn: Math.round(params.decisionTimeSec * 100) / 100,
    secim_riskli: params.isRiskyChoiceOrTimeout ? 1 : 0,
    kaynak: 'gercek',
  };
}

export function formatCsvRow(row: TelemetryRow): string {
  return [
    row.oturum,
    row.sahne_no,
    row.seviye,
    row.hedef,
    row.onceki_ipucu_sayisi,
    row.onceki_riskli_sayisi,
    row.onceki_timeout_sayisi,
    row.onceki_karar_suresi_sn,
    row.ipucu_bu_sahne,
    row.karar_suresi_sn,
    row.secim_riskli,
    row.kaynak,
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

  // 1. oturum
  if (typeof obj.oturum !== 'string' || !HEX_REGEX.test(obj.oturum)) {
    return {
      valid: false,
      error: 'Field "oturum" must be a 16-64 hex character string without free text',
    };
  }

  // 2. sahne_no (1..3)
  if (!Number.isInteger(obj.sahne_no) || (obj.sahne_no as number) < 1 || (obj.sahne_no as number) > 3) {
    return { valid: false, error: 'Field "sahne_no" must be an integer between 1 and 3' };
  }

  // 3. seviye (0 or 1)
  if (!Number.isInteger(obj.seviye) || ((obj.seviye as number) !== 0 && (obj.seviye as number) !== 1)) {
    return { valid: false, error: 'Field "seviye" must be 0 (Beginner) or 1 (Experienced)' };
  }

  // 4. hedef (0, 1, or 2)
  if (
    !Number.isInteger(obj.hedef) ||
    (obj.hedef as number) < 0 ||
    (obj.hedef as number) > 2
  ) {
    return { valid: false, error: 'Field "hedef" must be an integer between 0 and 2' };
  }

  // 5. onceki_ipucu_sayisi (integer 0..3)
  if (
    !Number.isInteger(obj.onceki_ipucu_sayisi) ||
    (obj.onceki_ipucu_sayisi as number) < 0 ||
    (obj.onceki_ipucu_sayisi as number) > 3
  ) {
    return {
      valid: false,
      error: 'Field "onceki_ipucu_sayisi" must be an integer between 0 and 3',
    };
  }

  // 6. onceki_riskli_sayisi (integer 0..3)
  if (
    !Number.isInteger(obj.onceki_riskli_sayisi) ||
    (obj.onceki_riskli_sayisi as number) < 0 ||
    (obj.onceki_riskli_sayisi as number) > 3
  ) {
    return {
      valid: false,
      error: 'Field "onceki_riskli_sayisi" must be an integer between 0 and 3',
    };
  }

  // 7. onceki_timeout_sayisi (integer 0..3)
  if (
    !Number.isInteger(obj.onceki_timeout_sayisi) ||
    (obj.onceki_timeout_sayisi as number) < 0 ||
    (obj.onceki_timeout_sayisi as number) > 3
  ) {
    return {
      valid: false,
      error: 'Field "onceki_timeout_sayisi" must be an integer between 0 and 3',
    };
  }

  // 8. onceki_karar_suresi_sn (number >= 0, <= 600)
  if (
    typeof obj.onceki_karar_suresi_sn !== 'number' ||
    !Number.isFinite(obj.onceki_karar_suresi_sn) ||
    (obj.onceki_karar_suresi_sn as number) < 0 ||
    (obj.onceki_karar_suresi_sn as number) > 600
  ) {
    return {
      valid: false,
      error: 'Field "onceki_karar_suresi_sn" must be a finite number between 0 and 600',
    };
  }

  // 9. ipucu_bu_sahne (0 or 1)
  if (
    !Number.isInteger(obj.ipucu_bu_sahne) ||
    ((obj.ipucu_bu_sahne as number) !== 0 && (obj.ipucu_bu_sahne as number) !== 1)
  ) {
    return { valid: false, error: 'Field "ipucu_bu_sahne" must be 0 or 1' };
  }

  // 10. karar_suresi_sn (number >= 0, <= 600)
  if (
    typeof obj.karar_suresi_sn !== 'number' ||
    !Number.isFinite(obj.karar_suresi_sn) ||
    (obj.karar_suresi_sn as number) < 0 ||
    (obj.karar_suresi_sn as number) > 600
  ) {
    return {
      valid: false,
      error: 'Field "karar_suresi_sn" must be a finite number between 0 and 600',
    };
  }

  // 11. secim_riskli (0 or 1)
  if (
    !Number.isInteger(obj.secim_riskli) ||
    ((obj.secim_riskli as number) !== 0 && (obj.secim_riskli as number) !== 1)
  ) {
    return { valid: false, error: 'Field "secim_riskli" must be 0 or 1' };
  }

  // 12. kaynak ("gercek" only)
  if (obj.kaynak !== 'gercek') {
    return { valid: false, error: 'Field "kaynak" must be "gercek"' };
  }

  return {
    valid: true,
    row: {
      oturum: obj.oturum as string,
      sahne_no: obj.sahne_no as number,
      seviye: obj.seviye as number,
      hedef: obj.hedef as number,
      onceki_ipucu_sayisi: obj.onceki_ipucu_sayisi as number,
      onceki_riskli_sayisi: obj.onceki_riskli_sayisi as number,
      onceki_timeout_sayisi: obj.onceki_timeout_sayisi as number,
      onceki_karar_suresi_sn: obj.onceki_karar_suresi_sn as number,
      ipucu_bu_sahne: obj.ipucu_bu_sahne as number,
      karar_suresi_sn: obj.karar_suresi_sn as number,
      secim_riskli: obj.secim_riskli as number,
      kaynak: 'gercek',
    },
  };
}
