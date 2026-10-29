import React from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  consequenceText: string;
  timedOut?: boolean;
  isLastDecision: boolean;
  onNext: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  consequenceText,
  timedOut,
  isLastDecision,
  onNext,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consequence-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity"
    >
      <div className="w-full max-w-md bg-[#1E293B] border-t border-[#334155] rounded-t-xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1 bg-[#475569] rounded-full mx-auto" />

        <div className="space-y-2">
          <h2
            id="consequence-sheet-title"
            className="text-lg font-bold text-[#F8FAFC]"
          >
            What happened and why
          </h2>

          {timedOut && (
            <p className="text-sm font-semibold text-[#EF4444]">
              You ran out of time.
            </p>
          )}

          <p
            data-testid="consequence"
            className="text-sm leading-relaxed text-[#DDE2F5]"
          >
            {consequenceText}
          </p>
        </div>

        <button
          type="button"
          data-testid="next-decision"
          onClick={onNext}
          className="w-full h-12 bg-[#F59E0B] hover:bg-[#D97706] text-[#0B111E] font-bold rounded text-sm transition-all cursor-pointer active:scale-[0.99]"
        >
          {isLastDecision ? 'View results' : 'Next decision'}
        </button>
      </div>
    </div>
  );
};
