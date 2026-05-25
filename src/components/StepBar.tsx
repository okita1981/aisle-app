import { useAppStore } from '../store/useAppStore';
import type { PhaseId } from '../types';

const steps: { id: PhaseId; label: string }[] = [
  { id: 1, label: 'ログ取得' },
  { id: 2, label: '因果分析' },
  { id: 3, label: '出現設計' },
  { id: 4, label: '突合検証' },
  { id: 5, label: '実装設計' },
];

export function StepBar() {
  const { currentPhase, logEntries, phase1Result, phase2Result, phase3Result, phase4Result } = useAppStore();

  const isCompleted = (id: PhaseId): boolean => {
    if (id === 1) return logEntries.length > 0;
    if (id === 2) return phase1Result !== null;
    if (id === 3) return phase2Result !== null;
    if (id === 4) return phase3Result !== null;
    if (id === 5) return phase4Result !== null;
    return false;
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted(step.id)
                    ? 'bg-green-500 text-white'
                    : currentPhase === step.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isCompleted(step.id) ? '✓' : String(step.id).padStart(2, '0')}
              </div>
              <span
                className={`text-sm font-medium ${
                  currentPhase === step.id
                    ? 'text-indigo-700'
                    : isCompleted(step.id)
                    ? 'text-green-700'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-px w-6 mx-2 ${
                  isCompleted(step.id) ? 'bg-green-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
