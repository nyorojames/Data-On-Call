import React from 'react';
import { EndingEvaluation, PlayerLevel } from '../game/rules.ts';
import { CheckCircle2, AlertTriangle, ShieldCheck, Database, Layers } from 'lucide-react';

interface EndingScreenProps {
  evaluation: EndingEvaluation;
  onPlayAgain: () => void;
  onChangeAnswers: () => void;
  onChangeLevel?: (newLevel: PlayerLevel) => void;
}

export const EndingScreen: React.FC<EndingScreenProps> = ({
  evaluation,
  onPlayAgain,
  onChangeAnswers,
  onChangeLevel,
}) => {
  const {
    endingTitle,
    causeMessage,
    results,
    isAllGood,
    weakestSkill,
    nextStep,
    levelRecommendation,
  } = evaluation;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col min-h-screen justify-between">
      {/* 1. Header / Ending Title & Status */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isAllGood ? 'bg-[#10B981]' : 'bg-[#EF4444]'
            }`}
          ></span>
          <span className="font-mono text-xs uppercase tracking-wider text-[#A08E7A]">
            Shift Summary &middot; 08:00
          </span>
        </div>

        <h1
          data-testid="ending-title"
          className="text-2xl font-bold tracking-tight text-[#F8FAFC] leading-snug"
        >
          {endingTitle}
        </h1>

        {/* Cause sentence if Ending B */}
        {causeMessage && (
          <p className="text-sm leading-relaxed text-[#FFB4AB] bg-[#93000A]/20 border border-[#93000A]/40 p-3 rounded">
            {causeMessage}
          </p>
        )}
      </div>

      {/* 2. Results, Weakest Skill & Next Step */}
      <div className="space-y-3 my-auto py-4">
        {/* Architecture */}
        <div
          data-testid="result-architecture"
          className="flex items-center justify-between p-4 bg-[#162032] border border-[#334155] rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <Layers className="w-5 h-5 text-[#94A3B8]" />
            <span className="text-sm font-semibold text-[#DDE2F5]">Pipeline architecture:{' '}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            {results.architecture.isGood ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span className="font-mono text-xs font-bold text-[#10B981]">Good</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-[#EF4444]">Risky</span>
              </>
            )}
          </div>
        </div>

        {/* Data quality */}
        <div
          data-testid="result-quality"
          className="flex items-center justify-between p-4 bg-[#162032] border border-[#334155] rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <Database className="w-5 h-5 text-[#94A3B8]" />
            <span className="text-sm font-semibold text-[#DDE2F5]">Data quality:{' '}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            {results.dataQuality.isGood ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span className="font-mono text-xs font-bold text-[#10B981]">Good</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-[#EF4444]">Risky</span>
              </>
            )}
          </div>
        </div>

        {/* Privacy */}
        <div
          data-testid="result-privacy"
          className="flex items-center justify-between p-4 bg-[#162032] border border-[#334155] rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-[#94A3B8]" />
            <span className="text-sm font-semibold text-[#DDE2F5]">Privacy:{' '}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            {results.privacy.isGood ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span className="font-mono text-xs font-bold text-[#10B981]">Good</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="font-mono text-xs font-bold text-[#EF4444]">Risky</span>
              </>
            )}
          </div>
        </div>

        {/* AC7: Weakest skill */}
        <div className="p-3 bg-[#162032] border border-[#334155] rounded-lg flex items-center justify-between">
          <span className="text-xs uppercase font-mono tracking-wider text-[#94A3B8]">
            Weakest skill:
          </span>
          <span
            data-testid="weakest-skill"
            className="text-xs font-mono font-bold text-[#FFC174]"
          >
            {weakestSkill}
          </span>
        </div>

        {/* AC7: Goal-specific next step */}
        <div className="p-3 bg-[#162032] border border-[#334155] rounded-lg space-y-1">
          <span className="text-xs uppercase font-mono tracking-wider text-[#94A3B8] block">
            Recommended next step:
          </span>
          <p
            data-testid="next-step"
            className="text-xs text-[#DDE2F5] leading-relaxed"
          >
            {nextStep}
          </p>
        </div>
      </div>

      {/* 3. Action buttons */}
      <div className="space-y-3 pb-6">
        {/* AC7: Level-change recommendation button */}
        {levelRecommendation && onChangeLevel && (
          <button
            type="button"
            data-testid="change-level"
            onClick={() => onChangeLevel(levelRecommendation)}
            className="w-full h-12 bg-[#F59E0B] hover:bg-[#D97706] text-[#0B111E] font-bold rounded text-sm transition-all shadow-lg shadow-[#F59E0B]/20 cursor-pointer active:scale-[0.99]"
          >
            {levelRecommendation === 'Experienced'
              ? 'Try Experienced mode'
              : 'Try Beginner mode'}
          </button>
        )}

        <button
          type="button"
          data-testid="play-again"
          onClick={onPlayAgain}
          className={`w-full ${
            levelRecommendation
              ? 'h-11 bg-[#162032] hover:bg-[#1E293B] text-[#DDE2F5] border border-[#334155]'
              : 'h-13 bg-[#F59E0B] hover:bg-[#D97706] text-[#0B111E] shadow-lg shadow-[#F59E0B]/20'
          } font-bold rounded text-sm transition-all cursor-pointer active:scale-[0.99]`}
        >
          Play again
        </button>

        <button
          type="button"
          onClick={onChangeAnswers}
          className="w-full h-11 bg-[#162032] hover:bg-[#1E293B] text-[#DDE2F5] border border-[#334155] font-semibold rounded text-sm transition-all cursor-pointer active:scale-[0.99]"
        >
          Change my answers
        </button>
      </div>
    </div>
  );
};
