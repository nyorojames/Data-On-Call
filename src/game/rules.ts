export type PlayerLevel = 'Beginner' | 'Experienced';
export type PlayerGoal = 'Internship prep' | 'Keep up with trends' | 'Use AI effectively';
export type DecisionChoice = 'A' | 'B' | 'C';
export type DecisionCategory = 'Pipeline architecture' | 'Data quality' | 'Privacy';

export interface DecisionOption {
  id: DecisionChoice;
  text: string;
  isGood: boolean;
  result: string;
}

export interface DecisionScenario {
  id: number;
  category: DecisionCategory;
  options: DecisionOption[];
  hintQuestion: string;
}

export const SCENARIO_TEXT =
  'The battery-swap telemetry pipeline is dropping data. Riders say swaps work fine. The ops manager needs the stock report at 08:00.';

export const HINTS: Record<number, string> = {
  1: 'Think about what a rollback restores. Does it also restore the data that was written meanwhile?',
  2: 'What is the smallest check you could run in two minutes that would tell you if the data is trustworthy?',
  3: 'Who needs to see the raw rider details to fix this, and who does not?',
};

export const CANONICAL_GUIDING_QUESTIONS: Record<number, string> = {
  1: 'Think about what a rollback restores. Does it also restore the data that was written meanwhile?',
  2: 'What is the smallest check you could run in two minutes that would tell you if the data is trustworthy?',
  3: 'Who needs to see the raw rider details to fix this, and who does not?',
};

export const FORBIDDEN_PHRASES = [
  'choose a',
  'choose b',
  'pick a',
  'pick b',
  'the answer is',
  'yes, it is',
];

export function sanitizeTutorReply(reply: string, decisionId: number): string {
  if (!reply) {
    return CANONICAL_GUIDING_QUESTIONS[decisionId] || CANONICAL_GUIDING_QUESTIONS[1];
  }
  const lower = reply.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) {
      return CANONICAL_GUIDING_QUESTIONS[decisionId] || CANONICAL_GUIDING_QUESTIONS[1];
    }
  }
  return reply;
}

export const TUTOR_QUESTION_BANK: Record<
  number,
  Record<PlayerGoal, Record<PlayerLevel, string>>
> = {
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

export const DECISIONS: DecisionScenario[] = [
  {
    id: 1,
    category: 'Pipeline architecture',
    options: [
      {
        id: 'A',
        text: 'Roll back the last deploy',
        isGood: true,
        result:
          'Rolling back restored the last stable version within minutes and data started flowing again.',
      },
      {
        id: 'B',
        text: 'Patch the live pipeline',
        isGood: false,
        result:
          'Patching live fixed some stations, but the pipeline stalled under load and new data was stored inconsistently.',
      },
    ],
    hintQuestion: HINTS[1],
  },
  {
    id: 2,
    category: 'Data quality',
    options: [
      {
        id: 'A',
        text: 'Validate a small sample first',
        isGood: true,
        result:
          'A sample check found 6% of readings had missing timestamps. You fixed that before reprocessing.',
      },
      {
        id: 'B',
        text: 'Backfill everything now',
        isGood: false,
        result:
          'Reprocessing everything copied the bad records too. The dashboard recovered, but stock numbers were silently wrong.',
      },
      {
        id: 'C',
        text: 'Ask an AI assistant to write a fix and run it',
        isGood: false,
        result:
          "The AI's fix ran without being checked and changed more records than intended.",
      },
    ],
    hintQuestion: HINTS[2],
  },
  {
    id: 3,
    category: 'Privacy',
    options: [
      {
        id: 'A',
        text: 'Mask rider phone numbers and locations in the logs',
        isGood: true,
        result: 'The team could debug without seeing personal data.',
      },
      {
        id: 'B',
        text: 'Share the logs with the team as they are',
        isGood: false,
        result:
          "Raw logs with rider phone numbers and GPS locations were shared. This is a data protection risk under Kenya's Data Protection Act, 2019.",
      },
    ],
    hintQuestion: HINTS[3],
  },
];

export const GOAL_RECOMMENDATIONS: Record<PlayerGoal, string> = {
  'Internship prep':
    'Practice explaining your decision trade-offs aloud as if answering a technical interview question.',
  'Keep up with trends':
    'Read up on modern stream-processing idempotency patterns and schema drift monitoring.',
  'Use AI effectively':
    'Review guidelines on prompt boundary hygiene and human-in-the-loop verification before production changes.',
};

export interface EndingEvaluation {
  isAllGood: boolean;
  endingTitle: string;
  causeMessage: string | null;
  weakestSkill: string;
  nextStep: string;
  levelRecommendation: PlayerLevel | null;
  results: {
    architecture: { isGood: boolean; label: 'Good' | 'Risky' };
    dataQuality: { isGood: boolean; label: 'Good' | 'Risky' };
    privacy: { isGood: boolean; label: 'Good' | 'Risky' };
  };
}

export function evaluateEnding(
  choices: Record<number, DecisionChoice>,
  playerGoal: PlayerGoal = 'Internship prep',
  playerLevel: PlayerLevel = 'Beginner'
): EndingEvaluation {
  const d1 = choices[1];
  const d2 = choices[2];
  const d3 = choices[3];

  const d1Good = d1 === 'A';
  const d2Good = d2 === 'A';
  const d3Good = d3 === 'A';

  const isAllGood = d1Good && d2Good && d3Good;

  let endingTitle: string;
  let causeMessage: string | null = null;
  let weakestSkill: string;

  if (isAllGood) {
    endingTitle = 'Ending A: Data correct, report on time';
    weakestSkill = 'Strong across all three';
  } else {
    endingTitle = 'Ending B: Risky shortcut caused data failure';

    // Find the FIRST risky decision
    if (!d1Good) {
      weakestSkill = 'Pipeline architecture';
      causeMessage =
        'Patching the live pipeline caused the pipeline to stall under load and data was stored inconsistently.';
    } else if (!d2Good) {
      weakestSkill = 'Data quality';
      if (d2 === 'C') {
        causeMessage =
          "Running the AI assistant's fix without verification changed more records than intended.";
      } else {
        causeMessage =
          'Reprocessing everything without sample validation copied bad records and silently corrupted stock numbers.';
      }
    } else {
      weakestSkill = 'Privacy';
      causeMessage =
        "Sharing raw logs with rider phone numbers and GPS locations breached Kenya's Data Protection Act, 2019.";
    }
  }

  // Count risky choices
  let riskyCount = 0;
  if (!d1Good) riskyCount++;
  if (!d2Good) riskyCount++;
  if (!d3Good) riskyCount++;

  let levelRecommendation: PlayerLevel | null = null;
  if (playerLevel === 'Beginner' && isAllGood) {
    levelRecommendation = 'Experienced';
  } else if (playerLevel === 'Experienced' && riskyCount >= 2) {
    levelRecommendation = 'Beginner';
  }

  const nextStep = GOAL_RECOMMENDATIONS[playerGoal];

  return {
    isAllGood,
    endingTitle,
    causeMessage,
    weakestSkill,
    nextStep,
    levelRecommendation,
    results: {
      architecture: { isGood: d1Good, label: d1Good ? 'Good' : 'Risky' },
      dataQuality: { isGood: d2Good, label: d2Good ? 'Good' : 'Risky' },
      privacy: { isGood: d3Good, label: d3Good ? 'Good' : 'Risky' },
    },
  };
}

export function getTutorQuestionForDecision(
  decisionId: number,
  goal: PlayerGoal,
  level: PlayerLevel = 'Beginner',
  aiOptionChosen = false
): string {
  if (decisionId === 2 && goal === 'Use AI effectively' && aiOptionChosen) {
    return "How would you verify the AI assistant's fix before running it against production station records?";
  }
  return (
    TUTOR_QUESTION_BANK[decisionId]?.[goal]?.[level] ??
    'What factors should you evaluate before taking action?'
  );
}

export function getHintForDecision(decisionId: number): string {
  return HINTS[decisionId] ?? 'What is the immediate risk of each option?';
}
