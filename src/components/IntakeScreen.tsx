import React from 'react';
import { PlayerLevel, PlayerGoal } from '../game/rules.ts';

interface IntakeScreenProps {
  level: PlayerLevel | null;
  goal: PlayerGoal | null;
  onSelectLevel: (lvl: PlayerLevel) => void;
  onSelectGoal: (g: PlayerGoal) => void;
  onStartShift: () => void;
}

export const IntakeScreen: React.FC<IntakeScreenProps> = ({
  level,
  goal,
  onSelectLevel,
  onSelectGoal,
  onStartShift,
}) => {
  const canStart = Boolean(level && goal);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col min-h-screen justify-between">
      {/* 1. Header */}
      <div className="space-y-2 pt-4">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-pulse"></span>
          <span className="font-mono text-xs uppercase tracking-wider text-[#A08E7A]">
            On-Call Incident Triage
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#F8FAFC]">
          Start your shift
        </h1>
        <p className="text-sm text-[#94A3B8]">
          You are the on-call data engineer for an electric motorcycle battery-swap network in Nairobi.
        </p>
      </div>

      {/* 2 & 3: Questions */}
      <div className="space-y-6 my-auto py-6">
        {/* Question 1: Your level */}
        <div className="space-y-2.5">
          <label className="block text-sm font-semibold tracking-wide text-[#DDE2F5]">
            Your level
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['Beginner', 'Experienced'] as PlayerLevel[]).map((lvl) => {
              const selected = level === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`level-${lvl.toLowerCase()}`}
                  onClick={() => onSelectLevel(lvl)}
                  className={`h-12 px-4 rounded border text-sm font-medium transition-all ${
                    selected
                      ? 'bg-[#1E293B] border-[#F59E0B] text-[#F59E0B] ring-1 ring-[#F59E0B]'
                      : 'bg-[#162032] border-[#334155] text-[#DDE2F5] hover:border-[#64748B]'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question 2: Your goal */}
        <div className="space-y-2.5">
          <label className="block text-sm font-semibold tracking-wide text-[#DDE2F5]">
            Your goal
          </label>
          <div className="flex flex-col space-y-2.5">
            {(
              [
                'Internship prep',
                'Keep up with trends',
                'Use AI effectively',
              ] as PlayerGoal[]
            ).map((g) => {
              const selected = goal === g;
              const testId =
                g === 'Internship prep'
                  ? 'goal-internship'
                  : g === 'Keep up with trends'
                  ? 'goal-trends'
                  : 'goal-ai';
              return (
                <button
                  key={g}
                  type="button"
                  data-testid={testId}
                  onClick={() => onSelectGoal(g)}
                  className={`h-12 px-4 rounded border text-left text-sm font-medium transition-all ${
                    selected
                      ? 'bg-[#1E293B] border-[#F59E0B] text-[#F59E0B] ring-1 ring-[#F59E0B]'
                      : 'bg-[#162032] border-[#334155] text-[#DDE2F5] hover:border-[#64748B]'
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Action Button */}
      <div className="pb-6">
        <button
          type="button"
          data-testid="start-shift"
          disabled={!canStart}
          onClick={onStartShift}
          className={`w-full h-14 rounded font-bold text-base transition-all ${
            canStart
              ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0B111E] shadow-lg shadow-[#F59E0B]/20 cursor-pointer active:scale-[0.99]'
              : 'bg-[#162032] text-[#64748B] border border-[#334155] cursor-not-allowed'
          }`}
        >
          Start shift
        </button>
      </div>
    </div>
  );
};
