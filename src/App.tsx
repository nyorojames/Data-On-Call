/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PlayerLevel, PlayerGoal, DecisionChoice, evaluateEnding } from './game/rules.ts';
import { TelemetryRow, buildTelemetryRow, generateSessionId } from './game/telemetry.ts';
import { predictRisk } from './game/model.ts';
import { IntakeScreen } from './components/IntakeScreen.tsx';
import { SceneScreen } from './components/SceneScreen.tsx';
import { EndingScreen } from './components/EndingScreen.tsx';

type ScreenState = 'intake' | 'scene' | 'ending';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('intake');
  const [level, setLevel] = useState<PlayerLevel | null>(null);
  const [goal, setGoal] = useState<PlayerGoal | null>(null);
  const [decisionIndex, setDecisionIndex] = useState(0);
  const [choices, setChoices] = useState<Record<number, DecisionChoice>>({});
  const [timeouts, setTimeouts] = useState<Record<number, boolean>>({});

  // Telemetry session state (random ID, strictly in memory, no personal data)
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const [sessionRows, setSessionRows] = useState<TelemetryRow[]>([]);
  const [hintsCount, setHintsCount] = useState(0);
  const [riskyCount, setRiskyCount] = useState(0);
  const [timeoutsCount, setTimeoutsCount] = useState(0);
  const [lastDecisionTimeSec, setLastDecisionTimeSec] = useState(0);
  const [isCollectionMode, setIsCollectionMode] = useState(false);

  // Parity testing mode (AC10): /?parity=1&x=0,0,1,0,0,0,0.0
  const [parityProb, setParityProb] = useState<number | null>(null);
  const isParityMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('parity') === '1';

  useEffect(() => {
    if (isParityMode) {
      const params = new URLSearchParams(window.location.search);
      const xParam = params.get('x');
      if (xParam) {
        const feats = xParam.split(',').map((val) => Number(val.trim()));
        if (feats.length === 7 && feats.every((num) => !isNaN(num))) {
          predictRisk(feats).then((prob) => {
            setParityProb(prob);
          });
        }
      }
    }
  }, [isParityMode]);

  // Check collection mode status on mount
  useEffect(() => {
    fetch('/api/log/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.collection_mode) {
          setIsCollectionMode(true);
        }
      })
      .catch(() => {});
  }, []);

  const resetSessionState = () => {
    setSessionId(generateSessionId());
    setChoices({});
    setTimeouts({});
    setSessionRows([]);
    setHintsCount(0);
    setRiskyCount(0);
    setTimeoutsCount(0);
    setLastDecisionTimeSec(0);
    setDecisionIndex(0);
  };

  // Check for ?autostart=1 support for quick headless checks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setLevel('Experienced');
      setGoal('Use AI effectively');
      resetSessionState();
      setScreen('scene');
    }
  }, []);

  const handleStartShift = () => {
    if (level && goal) {
      resetSessionState();
      setScreen('scene');
    }
  };

  const handleDecisionMade = (
    decisionId: number,
    choice: DecisionChoice,
    timedOut = false,
    decisionTimeSec = 0,
    hintViewed = false
  ) => {
    setChoices((prev) => ({
      ...prev,
      [decisionId]: choice,
    }));
    if (timedOut) {
      setTimeouts((prev) => ({
        ...prev,
        [decisionId]: true,
      }));
    }

    const isRisky = choice !== 'A' || timedOut;

    if (level && goal) {
      const row = buildTelemetryRow({
        sessionId,
        sceneNumber: decisionId,
        level,
        goal,
        previousHintsCount: hintsCount,
        previousRiskyCount: riskyCount,
        previousTimeoutsCount: timeoutsCount,
        previousDecisionTimeSec: lastDecisionTimeSec,
        hintViewedInThisScene: hintViewed,
        decisionTimeSec,
        isRiskyChoiceOrTimeout: isRisky,
      });

      setSessionRows((prev) => [...prev, row]);

      // Fire non-blocking POST to /api/log
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      }).catch(() => {
        // Non-blocking: if network fails, game continues uninterrupted
      });

      // Update counters for subsequent scenes
      setHintsCount((prev) => prev + (hintViewed ? 1 : 0));
      setRiskyCount((prev) => prev + (isRisky ? 1 : 0));
      setTimeoutsCount((prev) => prev + (timedOut ? 1 : 0));
      setLastDecisionTimeSec(row.decision_time_sec);
    }
  };

  const handleNextDecision = () => {
    if (decisionIndex < 2) {
      setDecisionIndex((prev) => prev + 1);
    } else {
      setScreen('ending');
    }
  };

  const handlePlayAgain = () => {
    setLevel(null);
    setGoal(null);
    resetSessionState();
    setScreen('intake');
  };

  const handleChangeAnswers = () => {
    resetSessionState();
    setScreen('scene');
  };

  const handleLevelChange = (newLevel: PlayerLevel) => {
    setLevel(newLevel);
    resetSessionState();
    setScreen('scene');
  };

  if (isParityMode) {
    return (
      <main className="min-h-screen bg-[#0B111E] text-[#DDE2F5] flex flex-col justify-center items-center p-4">
        {parityProb !== null && (
          <div
            data-cy="p"
            data-value={parityProb.toFixed(6)}
            className="font-mono text-sm text-[#94A3B8]"
          >
            Adaptive tutor (demo model, synthetic data): risk {parityProb.toFixed(2)}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B111E] text-[#DDE2F5] flex flex-col justify-center items-center relative">
      {isCollectionMode && (
        <div
          data-testid="collection-indicator"
          className="fixed top-2 right-2 z-50 px-2.5 py-1 text-[11px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40 rounded-full tracking-wide shadow-sm"
        >
          ● Data collection ON
        </div>
      )}

      {screen === 'intake' && (
        <IntakeScreen
          level={level}
          goal={goal}
          onSelectLevel={setLevel}
          onSelectGoal={setGoal}
          onStartShift={handleStartShift}
        />
      )}

      {screen === 'scene' && level && goal && (
        <SceneScreen
          key={decisionIndex}
          decisionIndex={decisionIndex}
          level={level}
          goal={goal}
          prevHintsCount={hintsCount}
          prevRiskyCount={riskyCount}
          prevTimeoutsCount={timeoutsCount}
          prevDecisionTimeSec={lastDecisionTimeSec}
          onDecisionMade={handleDecisionMade}
          onNextDecision={handleNextDecision}
        />
      )}

      {screen === 'ending' && (
        <EndingScreen
          evaluation={evaluateEnding(
            choices,
            level || 'Beginner',
            goal || 'Internship prep',
            timeouts
          )}
          sessionRows={sessionRows}
          onPlayAgain={handlePlayAgain}
          onChangeAnswers={handleChangeAnswers}
          onLevelChange={handleLevelChange}
        />
      )}
    </main>
  );
}
