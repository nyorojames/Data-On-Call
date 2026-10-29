import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEnding,
  getTutorQuestionForDecision,
  getHintForDecision,
  getWeakestSkill,
  getNextStep,
  getLevelChangeRecommendation,
  NEXT_STEPS,
  DECISIONS,
  SCENARIO_TEXT,
  PlayerGoal,
  PlayerLevel,
  LEAK_FILTER_REGEX,
  filterTutorReply,
} from './rules.ts';

test('Scenario constant and decisions are properly defined', () => {
  assert.equal(
    SCENARIO_TEXT,
    'The battery-swap telemetry pipeline is dropping data. Riders say swaps work fine. The ops manager needs the stock report at 08:00.'
  );
  assert.equal(DECISIONS.length, 3);
  assert.equal(DECISIONS[0].options.length, 2);
  assert.equal(DECISIONS[1].options.length, 3);
  assert.equal(DECISIONS[2].options.length, 2);
});

test('Ending A is produced when all decisions are Good (A, A, A)', () => {
  const result = evaluateEnding({ 1: 'A', 2: 'A', 3: 'A' });
  assert.equal(result.isAllGood, true);
  assert.equal(result.endingTitle, 'Ending A: Data correct, report on time');
  assert.equal(result.causeMessage, null);
  assert.equal(result.results.architecture.label, 'Good');
  assert.equal(result.results.dataQuality.label, 'Good');
  assert.equal(result.results.privacy.label, 'Good');
  assert.equal(result.weakestSkill, 'Strong across all three');
});

test('Ending B names the FIRST risky decision when Decision 1 is risky', () => {
  const result = evaluateEnding({ 1: 'B', 2: 'A', 3: 'A' });
  assert.equal(result.isAllGood, false);
  assert.equal(
    result.endingTitle,
    'Ending B: Report delivered, but something went wrong'
  );
  assert.ok(
    result.causeMessage?.includes('Patching the live pipeline'),
    'Should point to patching live pipeline'
  );
  assert.equal(result.results.architecture.label, 'Risky');
  assert.equal(result.results.dataQuality.label, 'Good');
  assert.equal(result.results.privacy.label, 'Good');
  assert.equal(result.weakestSkill, 'Architecture');
});

test('Ending B names Decision 2 (B) if Decision 1 was Good and Decision 2 was risky B', () => {
  const result = evaluateEnding({ 1: 'A', 2: 'B', 3: 'A' });
  assert.equal(result.isAllGood, false);
  assert.ok(
    result.causeMessage?.includes('Reprocessing everything without sample validation'),
    'Should point to reprocessing without sample check'
  );
  assert.equal(result.results.architecture.label, 'Good');
  assert.equal(result.results.dataQuality.label, 'Risky');
  assert.equal(result.results.privacy.label, 'Good');
  assert.equal(result.weakestSkill, 'Data quality');
});

test('Ending B names Decision 2 (C) if Decision 1 was Good and Decision 2 was AI option C', () => {
  const result = evaluateEnding({ 1: 'A', 2: 'C', 3: 'B' });
  assert.equal(result.isAllGood, false);
  assert.ok(
    result.causeMessage?.includes("Running the AI assistant's fix"),
    'Should point to AI assistant fix'
  );
  assert.equal(result.results.architecture.label, 'Good');
  assert.equal(result.results.dataQuality.label, 'Risky');
  assert.equal(result.results.privacy.label, 'Risky');
  assert.equal(result.weakestSkill, 'Data quality');
});

test('Ending B names Decision 3 if Decisions 1 and 2 were Good and Decision 3 was risky', () => {
  const result = evaluateEnding({ 1: 'A', 2: 'A', 3: 'B' });
  assert.equal(result.isAllGood, false);
  assert.ok(
    result.causeMessage?.includes("Kenya's Data Protection Act, 2019"),
    'Should point to Kenya Data Protection Act'
  );
  assert.equal(result.results.architecture.label, 'Good');
  assert.equal(result.results.dataQuality.label, 'Good');
  assert.equal(result.results.privacy.label, 'Risky');
  assert.equal(result.weakestSkill, 'Privacy');
});

test('Exact 18 questions match specification by decision, goal and level', () => {
  const expected: Record<number, Record<PlayerGoal, Record<PlayerLevel, string>>> = {
    1: {
      'Internship prep': {
        Beginner:
          'An interviewer asks: what is a data pipeline, and what could break in it when the database structure changes in a new release?',
        Experienced:
          'An interviewer asks: how do you make a pipeline safe to re-run, so that a retry or rollback never duplicates or loses data?',
      },
      'Keep up with trends': {
        Beginner:
          'Many teams now process data as a live stream instead of in nightly batches. What is the difference, and why does it matter when a release breaks something?',
        Experienced:
          'Data contracts are a growing practice. How would an agreed contract between the app team and your pipeline have caught this change before it shipped?',
      },
      'Use AI effectively': {
        Beginner:
          'If an AI assistant told you to patch the live system, what would you want to check before trusting it?',
        Experienced:
          'An AI agent proposes a hot patch with a clean diff. What evidence would you require before it touches production, and who owns that decision?',
      },
    },
    2: {
      'Internship prep': {
        Beginner:
          'An interviewer asks: what are three simple checks you would run on a new dataset to see whether it can be trusted?',
        Experienced:
          'An interviewer asks: how would you validate a backfill before it overwrites production tables, and how would you undo it if it went wrong?',
      },
      'Keep up with trends': {
        Beginner:
          'Teams now watch data the way they watch servers (data observability). What would you monitor to know the data is fresh and complete?',
        Experienced:
          'How would automated freshness, volume and schema alerts have caught this before the ops manager did, and which would you set up first?',
      },
      'Use AI effectively': {
        Beginner:
          'An AI suggests a quick fix for the bad readings. How could you check it worked without trusting it blindly?',
        Experienced:
          "The AI's fix passes its own tests. How do you build an independent check, and what would its tests not catch?",
      },
    },
    3: {
      'Internship prep': {
        Beginner:
          "An interviewer asks: what is personal data, and why shouldn't it appear in logs shared with the whole team?",
        Experienced:
          'An interviewer asks: how would you design logging so personal data never appears, instead of masking it afterwards?',
      },
      'Keep up with trends': {
        Beginner:
          "Many companies now mask personal data by default, and laws like Kenya's Data Protection Act push them to. What does 'by default' change about how you build a pipeline?",
        Experienced:
          'Compare masking, tokenizing and dropping fields at ingestion. What does each cost you when debugging?',
      },
      'Use AI effectively': {
        Beginner:
          'If you paste these logs into an AI assistant, where might the data go, and what should you remove first?',
        Experienced:
          'Your team wants an LLM for incident triage. What data boundary would you set, and how would you enforce it in the pipeline?',
      },
    },
  };

  const goals: PlayerGoal[] = ['Internship prep', 'Keep up with trends', 'Use AI effectively'];
  const levels: PlayerLevel[] = ['Beginner', 'Experienced'];

  for (let dec = 1; dec <= 3; dec++) {
    for (const g of goals) {
      for (const lvl of levels) {
        const actual = getTutorQuestionForDecision(dec, g, lvl);
        assert.equal(actual, expected[dec][g][lvl]);
      }
    }
  }
});

test('Exact 3 hints match specification', () => {
  assert.equal(
    getHintForDecision(1),
    'Think about what a rollback restores. Does it also restore the data that was written meanwhile?'
  );
  assert.equal(
    getHintForDecision(2),
    'What is the smallest check you could run in two minutes that would tell you if the data is trustworthy?'
  );
  assert.equal(
    getHintForDecision(3),
    'Who needs to see the raw rider details to fix this, and who does not?'
  );
});

test('AC7: getWeakestSkill returns Strong across all three when none risky, else first risky skill', () => {
  assert.equal(getWeakestSkill({ 1: 'A', 2: 'A', 3: 'A' }), 'Strong across all three');
  assert.equal(getWeakestSkill({ 1: 'B', 2: 'A', 3: 'A' }), 'Architecture');
  assert.equal(getWeakestSkill({ 1: 'A', 2: 'B', 3: 'A' }), 'Data quality');
  assert.equal(getWeakestSkill({ 1: 'A', 2: 'C', 3: 'A' }), 'Data quality');
  assert.equal(getWeakestSkill({ 1: 'A', 2: 'A', 3: 'B' }), 'Privacy');
  assert.equal(getWeakestSkill({ 1: 'B', 2: 'B', 3: 'B' }), 'Architecture');
});

test('AC7: getNextStep returns goal-aligned recommendation', () => {
  assert.equal(
    getNextStep('Internship prep'),
    NEXT_STEPS['Internship prep']
  );
  assert.equal(
    getNextStep('Keep up with trends'),
    NEXT_STEPS['Keep up with trends']
  );
  assert.equal(
    getNextStep('Use AI effectively'),
    NEXT_STEPS['Use AI effectively']
  );
});

test('AC7: getLevelChangeRecommendation matches specification rules', () => {
  // Beginner + all good => Try Experienced mode
  const beginnerGood = getLevelChangeRecommendation('Beginner', true, 0);
  assert.deepEqual(beginnerGood, {
    targetLevel: 'Experienced',
    buttonText: 'Try Experienced mode',
  });

  // Beginner + 1 or more risky => null
  assert.equal(getLevelChangeRecommendation('Beginner', false, 1), null);
  assert.equal(getLevelChangeRecommendation('Beginner', false, 2), null);

  // Experienced + 0 or 1 risky => null
  assert.equal(getLevelChangeRecommendation('Experienced', true, 0), null);
  assert.equal(getLevelChangeRecommendation('Experienced', false, 1), null);

  // Experienced + 2 or more risky/timeouts => Try Beginner mode
  const expRisky2 = getLevelChangeRecommendation('Experienced', false, 2);
  assert.deepEqual(expRisky2, {
    targetLevel: 'Beginner',
    buttonText: 'Try Beginner mode',
  });
  const expRisky3 = getLevelChangeRecommendation('Experienced', false, 3);
  assert.deepEqual(expRisky3, {
    targetLevel: 'Beginner',
    buttonText: 'Try Beginner mode',
  });
});

test('Answer leak filter replaces explicit answer directives', () => {
  assert.equal(
    filterTutorReply('I recommend you choose A because rolling back is safer.', 1),
    'Think about what a rollback restores. Does it also restore the data that was written meanwhile?'
  );
  assert.equal(
    filterTutorReply('You should pick B to backfill all records.', 2),
    'Consider how backfilling might impact the active ingestion queue. Could a high volume backfill cause more data drops?'
  );
  assert.equal(
    filterTutorReply('The answer is A for Decision 3.', 3),
    'Who needs to see the raw rider details to fix this, and who does not?'
  );
});

test('Answer leak filter does NOT replace conditional guiding questions', () => {
  const q1 = 'If you select B, how would you distinguish between normal battery discharge and hardware failure?';
  assert.equal(filterTutorReply(q1, 2), q1);

  const q2 = 'Why might you choose a rollback? What data could be affected?';
  assert.equal(filterTutorReply(q2, 1), q2);

  const q3 = 'What happens if you pick B? Would that overload your downstream database?';
  assert.equal(filterTutorReply(q3, 2), q3);
});
