import React, { useState, useEffect, useRef } from 'react';
import {
  PlayerLevel,
  PlayerGoal,
  DecisionChoice,
  DECISIONS,
  SCENARIO_TEXT,
  getHintForDecision,
  getTutorQuestionForDecision,
} from '../game/rules.ts';
import { BottomSheet } from './BottomSheet.tsx';

interface SceneScreenProps {
  decisionIndex: number; // 0, 1, 2 (corresponding to Decision 1, 2, 3)
  level: PlayerLevel;
  goal: PlayerGoal;
  onDecisionMade: (decisionId: number, choice: DecisionChoice, timedOut?: boolean) => void;
  onNextDecision: () => void;
}

export const SceneScreen: React.FC<SceneScreenProps> = ({
  decisionIndex,
  level,
  goal,
  onDecisionMade,
  onNextDecision,
}) => {
  const currentDecision = DECISIONS[decisionIndex];
  const decisionNumber = decisionIndex + 1;
  const isLastDecision = decisionIndex === DECISIONS.length - 1;

  // Selected option & bottom sheet state
  const [selectedChoice, setSelectedChoice] = useState<DecisionChoice | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [consequenceText, setConsequenceText] = useState('');

  // Hint state (Beginner mode)
  const [showHint, setShowHint] = useState(false);

  // Timer state (Experienced mode)
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Tutor state
  const [tutorReply, setTutorReply] = useState<string>(() =>
    getTutorQuestionForDecision(currentDecision.id, goal, level)
  );
  const [userInput, setUserInput] = useState('');
  const [isSubmittingTutor, setIsSubmittingTutor] = useState(false);
  const [isTutorError, setIsTutorError] = useState(false);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState('');

  // Reset states when decision changes
  useEffect(() => {
    setSelectedChoice(null);
    setIsTimedOut(false);
    setShowBottomSheet(false);
    setConsequenceText('');
    setShowHint(false);
    setTimeLeft(60);
    setTutorReply(getTutorQuestionForDecision(currentDecision.id, goal, level));
    setUserInput('');
    setIsTutorError(false);
    setLastSubmittedMessage('');
  }, [decisionIndex, currentDecision.id, goal, level]);

  const handleTimeOut = () => {
    if (showBottomSheet || selectedChoice) return;
    // Record the risky option (option B is default risky)
    const riskyOption =
      currentDecision.options.find((opt) => !opt.isGood) ||
      currentDecision.options[1];
    setSelectedChoice(riskyOption.id);
    setIsTimedOut(true);
    setConsequenceText(riskyOption.result);
    setShowBottomSheet(true);
    onDecisionMade(currentDecision.id, riskyOption.id, true);
  };

  // Countdown timer for Experienced players
  useEffect(() => {
    if (level !== 'Experienced' || showBottomSheet) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (timeLeft <= 0) {
      handleTimeOut();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [level, showBottomSheet, timeLeft]);

  const handleSelectOption = (optionId: DecisionChoice) => {
    if (showBottomSheet) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const option = currentDecision.options.find((o) => o.id === optionId);
    if (!option) return;

    setSelectedChoice(optionId);
    setConsequenceText(option.result);
    setShowBottomSheet(true);
    onDecisionMade(currentDecision.id, optionId, false);

    // Goal = Use AI effectively: if Option C chosen in Decision 2, tutor asks follow-up
    if (currentDecision.id === 2 && goal === 'Use AI effectively' && optionId === 'C') {
      setIsTutorError(false);
      setTutorReply(getTutorQuestionForDecision(2, 'Use AI effectively', level, true));
    }
  };

  const sendMessageToTutor = async (textToSend: string) => {
    setIsSubmittingTutor(true);
    setIsTutorError(false);

    const delays = [1000, 2000, 4000];
    let succeeded = false;

    // Initial attempt + retry up to 3 times (waiting 1s, then 2s, then 4s)
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const res = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            decisionId: currentDecision.id,
            goal,
            level,
          }),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        if (data.reply) {
          setTutorReply(data.reply);
          setIsTutorError(false);
          succeeded = true;
          break;
        } else {
          throw new Error('No reply in response');
        }
      } catch (err) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
      }
    }

    if (!succeeded) {
      setIsTutorError(true);
    }
    setIsSubmittingTutor(false);
  };

  const handleSendTutorMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const inputEl = form.elements.namedItem('tutorQuery') as HTMLInputElement | null;
    const textToSend = (inputEl?.value || userInput).trim();
    if (!textToSend || isSubmittingTutor) return;

    setLastSubmittedMessage(textToSend);
    setUserInput('');
    if (inputEl) inputEl.value = '';

    await sendMessageToTutor(textToSend);
  };

  const handleTryAgain = () => {
    if (isSubmittingTutor) return;
    const messageToRetry = lastSubmittedMessage || userInput.trim() || 'Can you give me a hint?';
    sendMessageToTutor(messageToRetry);
  };

  // Determine available options
  // Decision 2 has option C ONLY when goal = "Use AI effectively"
  const availableOptions = currentDecision.options.filter((opt) => {
    if (opt.id === 'C') {
      return currentDecision.id === 2 && goal === 'Use AI effectively';
    }
    return true;
  });

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 flex flex-col min-h-screen justify-between">
      {/* 1. Top bar: clock "06:45" and "40% stations offline" in red + Timer or Hint */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center space-x-3">
            <span
              data-testid="clock"
              className="font-mono text-lg font-bold text-[#F8FAFC] tracking-wider"
            >
              06:45
            </span>
            <span className="text-sm font-semibold text-[#EF4444]">
              40% stations offline
            </span>
          </div>

          <div>
            {level === 'Experienced' ? (
              <div
                data-testid="timer"
                className="font-mono text-sm font-bold text-[#F59E0B] px-2 py-1 bg-[#1E293B] rounded border border-[#334155]"
              >
                {timeLeft}s
              </div>
            ) : (
              <button
                type="button"
                data-testid="hint"
                onClick={() => setShowHint(!showHint)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded bg-[#1E293B] hover:bg-[#2A354A] text-[#F59E0B] border border-[#334155] transition-colors cursor-pointer"
              >
                {showHint ? 'Hide hint' : 'Hint'}
              </button>
            )}
          </div>
        </div>

        {/* Beginner Hint Question Display */}
        {showHint && level === 'Beginner' && (
          <div className="p-3 bg-[#162032] border border-[#F59E0B]/40 rounded text-xs text-[#FFC174] leading-relaxed animate-in fade-in">
            <span className="font-semibold block mb-1">Guiding question:</span>
            {getHintForDecision(currentDecision.id)}
          </div>
        )}
      </div>

      {/* 2. Scenario card */}
      <div
        data-testid="scenario"
        className="my-3 p-4 bg-[#162032] border border-[#334155] rounded-lg shadow-sm"
      >
        <p className="text-sm leading-relaxed text-[#DDE2F5]">
          {SCENARIO_TEXT}
        </p>
      </div>

      {/* 3. Decision label */}
      <div className="my-1">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-[#A08E7A]">
          Decision {decisionNumber} of 3
        </span>
      </div>

      {/* 4. Large option buttons (show ONLY choice text!) */}
      <div className="space-y-3 my-2">
        {availableOptions.map((option) => {
          const testId =
            option.id === 'A'
              ? 'option-a'
              : option.id === 'B'
              ? 'option-b'
              : 'option-c';

          return (
            <button
              key={option.id}
              type="button"
              data-testid={testId}
              onClick={() => handleSelectOption(option.id)}
              disabled={showBottomSheet}
              className={`w-full min-h-[54px] px-4 py-3 text-left rounded font-medium text-sm transition-all border cursor-pointer active:scale-[0.99] ${
                selectedChoice === option.id
                  ? 'bg-[#1E293B] border-[#F59E0B] text-[#F8FAFC] ring-1 ring-[#F59E0B]'
                  : 'bg-[#162032] border-[#334155] text-[#F8FAFC] hover:border-[#64748B] hover:bg-[#1E293B]'
              }`}
            >
              {option.text}
            </button>
          );
        })}
      </div>

      {/* 5. Tutor box with message and text input */}
      <div className="my-3 p-3 bg-[#162032] border border-[#334155] rounded-lg space-y-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            AI Tutor
          </span>
        </div>

        <div
          data-testid="tutor-reply"
          className="text-xs leading-relaxed text-[#DDE2F5] bg-[#0F172A] p-2.5 rounded border border-[#1E293B]"
        >
          {isTutorError ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span>
                The tutor is busy right now. Here is a question to think about:{' '}
                <span data-testid="opening-question">
                  {getTutorQuestionForDecision(currentDecision.id, goal, level)}
                </span>
              </span>
              <button
                type="button"
                onClick={handleTryAgain}
                disabled={isSubmittingTutor}
                className="shrink-0 px-2.5 py-1 text-xs font-semibold bg-[#1E293B] hover:bg-[#2A354A] text-[#F59E0B] border border-[#334155] rounded transition-colors cursor-pointer"
              >
                {isSubmittingTutor ? 'Retrying...' : 'Try again'}
              </button>
            </div>
          ) : (
            <span data-testid="opening-question">{tutorReply}</span>
          )}
        </div>

        <form onSubmit={handleSendTutorMessage} className="flex gap-2">
          <input
            type="text"
            name="tutorQuery"
            data-testid="tutor-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask the tutor..."
            className="flex-1 h-9 px-3 bg-[#0F172A] border border-[#334155] focus:border-[#F59E0B] rounded text-xs text-[#F8FAFC] outline-none font-sans"
          />
          <button
            type="submit"
            disabled={isSubmittingTutor}
            className="px-3 h-9 bg-[#1E293B] hover:bg-[#2A354A] disabled:opacity-50 text-[#F59E0B] border border-[#334155] rounded text-xs font-semibold transition-all cursor-pointer"
          >
            Ask
          </button>
        </form>
      </div>

      {/* 6. Consequence Bottom Sheet */}
      <BottomSheet
        isOpen={showBottomSheet}
        consequenceText={consequenceText}
        timedOut={isTimedOut}
        isLastDecision={isLastDecision}
        onNext={onNextDecision}
      />
    </div>
  );
};
