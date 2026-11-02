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
    oturum: sessionId,
    sahne_no: 1,
    seviye: 0,
    hedef: 0,
    onceki_ipucu_sayisi: 0,
    onceki_riskli_sayisi: 0,
    onceki_timeout_sayisi: 0,
    onceki_karar_suresi_sn: 0,
    ipucu_bu_sahne: 1,
    karar_suresi_sn: 14.52,
    secim_riskli: 0,
    kaynak: 'gercek',
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
    oturum: sessionId,
    sahne_no: 2,
    seviye: 1,
    hedef: 2,
    onceki_ipucu_sayisi: 1,
    onceki_riskli_sayisi: 1,
    onceki_timeout_sayisi: 1,
    onceki_karar_suresi_sn: 25.1,
    ipucu_bu_sahne: 0,
    karar_suresi_sn: 32.4,
    secim_riskli: 1,
    kaynak: 'gercek',
  });
});

test('formatCsvRow and formatCsvFile generate expected CSV formatting', () => {
  const row: TelemetryRow = {
    oturum: 'abc0123456789abcdef0123456789abc',
    sahne_no: 1,
    seviye: 0,
    hedef: 1,
    onceki_ipucu_sayisi: 0,
    onceki_riskli_sayisi: 0,
    onceki_timeout_sayisi: 0,
    onceki_karar_suresi_sn: 0,
    ipucu_bu_sahne: 0,
    karar_suresi_sn: 12.34,
    secim_riskli: 0,
    kaynak: 'gercek',
  };

  const formattedRow = formatCsvRow(row);
  assert.equal(
    formattedRow,
    'abc0123456789abcdef0123456789abc,1,0,1,0,0,0,0,0,12.34,0,gercek'
  );

  const formattedFile = formatCsvFile([row]);
  assert.equal(
    formattedFile,
    'oturum,sahne_no,seviye,hedef,onceki_ipucu_sayisi,onceki_riskli_sayisi,onceki_timeout_sayisi,onceki_karar_suresi_sn,ipucu_bu_sahne,karar_suresi_sn,secim_riskli,kaynak\n' +
      'abc0123456789abcdef0123456789abc,1,0,1,0,0,0,0,0,12.34,0,gercek\n'
  );
});

test('validateTelemetryPayload succeeds on valid payload', () => {
  const valid = {
    oturum: '0123456789abcdef0123456789abcdef',
    sahne_no: 2,
    seviye: 1,
    hedef: 2,
    onceki_ipucu_sayisi: 1,
    onceki_riskli_sayisi: 0,
    onceki_timeout_sayisi: 0,
    onceki_karar_suresi_sn: 18.2,
    ipucu_bu_sahne: 0,
    karar_suresi_sn: 24.5,
    secim_riskli: 1,
    kaynak: 'gercek',
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
    oturum: '0123456789abcdef0123456789abcdef',
    sahne_no: 1,
    seviye: 0,
    hedef: 0,
    onceki_ipucu_sayisi: 0,
    onceki_riskli_sayisi: 0,
    onceki_timeout_sayisi: 0,
    onceki_karar_suresi_sn: 0,
    ipucu_bu_sahne: 0,
    karar_suresi_sn: 10,
    secim_riskli: 0,
    kaynak: 'gercek',
  };

  // Missing field
  const missing = { ...base };
  delete (missing as Record<string, unknown>).kaynak;
  assert.equal(validateTelemetryPayload(missing).valid, false);

  // Extra unexpected field
  assert.equal(
    validateTelemetryPayload({ ...base, extra_field: 'malicious' }).valid,
    false
  );

  // Invalid oturum (free text / non-hex)
  assert.equal(
    validateTelemetryPayload({ ...base, oturum: 'user-name-123' }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, oturum: 'DROP TABLE users;' }).valid,
    false
  );

  // Invalid sahne_no
  assert.equal(validateTelemetryPayload({ ...base, sahne_no: 0 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, sahne_no: 4 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, sahne_no: 1.5 }).valid, false);

  // Invalid seviye
  assert.equal(validateTelemetryPayload({ ...base, seviye: 2 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, seviye: -1 }).valid, false);

  // Invalid hedef
  assert.equal(validateTelemetryPayload({ ...base, hedef: 3 }).valid, false);
  assert.equal(validateTelemetryPayload({ ...base, hedef: -1 }).valid, false);

  // Invalid counts (< 0 or > 3)
  assert.equal(
    validateTelemetryPayload({ ...base, onceki_ipucu_sayisi: -1 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, onceki_ipucu_sayisi: 4 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, onceki_riskli_sayisi: 4 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, onceki_timeout_sayisi: 4 }).valid,
    false
  );

  // Invalid times (< 0 or NaN)
  assert.equal(
    validateTelemetryPayload({ ...base, onceki_karar_suresi_sn: -5 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, karar_suresi_sn: NaN }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, karar_suresi_sn: 1000 }).valid,
    false
  );

  // Invalid binary flags
  assert.equal(
    validateTelemetryPayload({ ...base, ipucu_bu_sahne: 2 }).valid,
    false
  );
  assert.equal(
    validateTelemetryPayload({ ...base, secim_riskli: 2 }).valid,
    false
  );

  // Invalid kaynak
  assert.equal(
    validateTelemetryPayload({ ...base, kaynak: 'synthetic' }).valid,
    false
  );
});
