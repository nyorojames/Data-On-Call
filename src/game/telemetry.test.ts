import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSessionId,
  buildTelemetryRow,
  formatCsvRow,
  formatCsvFile,
  validateTelemetryPayload,
  mapLevelToCode,
  mapGoalToCode,
  TelemetryRow,
} from './telemetry.ts';

test('generateSessionId generates valid 32-character hex token', () => {
  const id1 = generateSessionId();
  const id2 = generateSessionId();
  assert.equal(id1.length, 32);
  assert.equal(id2.length, 32);
  assert.match(id1, /^[a-f0-9]{32}$/);
  assert.match(id2, /^[a-f0-9]{32}$/);
  assert.notEqual(id1, id2);
});

test('mapLevelToCode and mapGoalToCode return correct integer codes', () => {
  assert.equal(mapLevelToCode('Beginner'), 0);
  assert.equal(mapLevelToCode('Experienced'), 1);

  assert.equal(mapGoalToCode('Internship prep'), 0);
  assert.equal(mapGoalToCode('Keep up with trends'), 1);
  assert.equal(mapGoalToCode('Use AI effectively'), 2);
});

test('buildTelemetryRow correctly constructs Scene 1 row with zero previous values', () => {
  const sessionId = generateSessionId();
  const row = buildTelemetryRow({
    sessionId,
    sceneNumber: 1,
    level: 'Beginner',
    goal: 'Internship prep',
    previousHintsCount: 0,
    previousRiskyCount: 0,
    previousTimeoutsCount: 0,
    previousDecisionTimeSec: 0,
    hintViewedInThisScene: true,
    decisionTimeSec: 14.52,
    isRiskyChoiceOrTimeout: false,
  });

  assert.deepEqual(row, {
    session_id: sessionId,
    scene_no: 1,
    level: 0,
    goal: 0,
    prev_hints_used: 0,
    prev_risky_count: 0,
    prev_timeout_count: 0,
    prev_decision_time_sec: 0,
    hint_used_this_scene: 1,
    decision_time_sec: 14.52,
    chose_risky: 0,
    source: 'real',
  });
});

test('buildTelemetryRow correctly propagates previous counts for Scene 2', () => {
  const sessionId = generateSessionId();
  const row = buildTelemetryRow({
    sessionId,
    sceneNumber: 2,
    level: 'Experienced',
    goal: 'Use AI effectively',
    previousHintsCount: 1,
    previousRiskyCount: 1,
    previousTimeoutsCount: 1,
    previousDecisionTimeSec: 25.1,
    hintViewedInThisScene: false,
    decisionTimeSec: 32.4,
    isRiskyChoiceOrTimeout: true,
  });

  assert.deepEqual(row, {
    session_id: sessionId,
    scene_no: 2,
    level: 1,
    goal: 2,
    prev_hints_used: 1,
    prev_risky_count: 1,
    prev_timeout_count: 1,
    prev_decision_time_sec: 25.1,
    hint_used_this_scene: 0,
    decision_time_sec: 32.4,
    chose_risky: 1,
    source: 'real',
  });
});

test('formatCsvRow and formatCsvFile generate expected CSV formatting', () => {
  const row: TelemetryRow = {
    session_id: 'abc0123456789abcdef0123456789abc',
    scene_no: 1,
    level: 0,
    goal: 1,
    prev_hints_used: 0,
    prev_risky_count: 0,
    prev_timeout_count: 0,
    prev_decision_time_sec: 0,
    hint_used_this_scene: 0,
    decision_time_sec: 12.34,
    chose_risky: 0,
    source: 'real',
  };

  const formattedRow = formatCsvRow(row);
  assert.equal(
    formattedRow,
    'abc0123456789abcdef0123456789abc,1,0,1,0,0,0,0,0,12.34,0,real'
  );

  const formattedFile = formatCsvFile([row]);
  assert.equal(
    formattedFile,
    'session_id,scene_no,level,goal,prev_hints_used,prev_risky_count,prev_timeout_count,prev_decision_time_sec,hint_used_this_scene,decision_time_sec,chose_risky,source\n' +
      'abc0123456789abcdef0123456789abc,1,0,1,0,0,0,0,0,12.34,0,real\n'
  );
});

test('validateTelemetryPayload succeeds on valid payload', () => {
  const valid = {
    session_id: '0123456789abcdef0123456789abcdef',
    scene_no: 2,
    level: 1,
    goal: 2,
    prev_hints_used: 1,
    prev_risky_count: 0,
    prev_timeout_count: 0,
    prev_decision_time_sec: 18.2,
    hint_used_this_scene: 0,
    decision_time_sec: 24.5,
    chose_risky: 1,
    source: 'real',
  };

  const res = validateTelemetryPayload(valid);
  assert.equal(res.valid, true);
  assert.deepEqual(res.row, valid);
});

test('validateTelemetryPayload rejects invalid payloads with descriptive errors', () => {
  // Non-object
  assert.equal(validateTelemetryPayload(null).valid, false);
  assert.equal(validateTelemetryPayload('string').valid, false);
  assert.equal(validateTelemetryPayload([]).valid, false);

  const base = {
    session_id: '0123456789abcdef0123456789abcdef',
    scene_no: 1,
    level: 0,
    goal: 0,
    prev_hints_used: 0,
    prev_risky_count: 0,
    prev_timeout_count: 0,
    prev_decision_time_sec: 0,
    hint_used_this_scene: 0,
    decision_time_sec: 10,
    chose_risky: 0,
    source: 'real',
  };

  // Missing field
  const missing = { ...base };
  delete (missing as Record<string, unknown>).source;
  assert.equal(validateTelemetryPayload(missing).valid, false);

  // Extra unexpected field
  assert.equal(
    validateTelemetryPayload({ ...base, extra_field: 'malicious' }).valid,
    false
  );

  // Invalid session_id (free text / non-hex)
  assert.equal(
    validateTelemetryPayload({ ...base, session_id: 'user-name-123' }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, session_id: 'DROP TABLE users;' }).valid,
    false
  );

  // Invalid scene_no
  assert.equal(validateTelemetryPayload({ ...base, scene_no: 0 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, scene_no: 4 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, scene_no: 1.5 }).valid, false);

  // Invalid level
  assert.equal(validateTelemetryPayload({ ...base, level: 2 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, level: -1 }).valid, false);

  // Invalid goal
  assert.equal(validateTelemetryPayload({ ...base, goal: 3 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, goal: -1 }).valid, false);

  // Invalid counts (< 0 or > 3)
  assert.equal(
    validateTelemetryPayload({ ...base, prev_hints_used: -1 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, prev_hints_used: 4 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, prev_risky_count: 4 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, prev_timeout_count: 4 }).valid,
    false
  );

  // Invalid times (< 0 or NaN)
  assert.equal(
    validateTelemetryPayload({ ...base, prev_decision_time_sec: -5 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, decision_time_sec: NaN }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, decision_time_sec: 1000 }).valid,
    false
  );

  // Invalid binary flags
  assert.equal(
    validateTelemetryPayload({ ...base, hint_used_this_scene: 2 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, chose_risky: 2 }).valid,
    false
  );

  // Invalid source
  assert.equal(
    validateTelemetryPayload({ ...base, source: 'invalid_source' }).valid,
    false
  );
});
