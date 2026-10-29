/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PlayerLevel, PlayerGoal, DecisionChoice, evaluateEnding } from './game/rules.ts';
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

  // Check for ?autostart=1 support for quick headless checks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setLevel('Experienced');
      setGoal('Use AI effectively');
      setDecisionIndex(0);
      setScreen('scene');
    }
  }, []);

  const handleStartShift = () => {
    if (level && goal) {
      setDecisionIndex(0);
      setChoices({});
      setTimeouts({});
      setScreen('scene');
    }
  };

  const handleDecisionMade = (
    decisionId: number,
    choice: DecisionChoice,
    timedOut = false
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
    setChoices({});
    setTimeouts({});
    setDecisionIndex(0);
    setScreen('intake');
  };

  const handleChangeAnswers = () => {
    setChoices({});
    setTimeouts({});
    setDecisionIndex(0);
    setScreen('scene');
  };

  const handleLevelChange = (newLevel: PlayerLevel) => {
    setLevel(newLevel);
    setChoices({});
    setTimeouts({});
    setDecisionIndex(0);
    setScreen('scene');
  };

  return (
    <main className="min-h-screen bg-[#0B111E] text-[#DDE2F5] flex flex-col justify-center items-center">
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
          onPlayAgain={handlePlayAgain}
          onChangeAnswers={handleChangeAnswers}
          onLevelChange={handleLevelChange}
        />
      )}
    </main>
  );
}
