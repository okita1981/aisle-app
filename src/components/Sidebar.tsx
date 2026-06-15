import { useAppStore } from '../store/useAppStore';
import type { PhaseId } from '../types';

const phases: { id: PhaseId; label: string; sublabel: string; icon: string }[] = [
  { id: 1, label: 'ログ取得',  sublabel: 'AI出力ログ自動収集',      icon: '🤖' },
  { id: 2, label: '因果分析',  sublabel: 'なぜ出ないかを分析',       icon: '📊' },
  { id: 3, label: '出現設計',  sublabel: 'After構文設計',           icon: '🎯' },
  { id: 4, label: '突合検証',  sublabel: '設計と現状の差分診断',     icon: '🔍' },
  { id: 5, label: '実装設計',  sublabel: 'AI専用ページ生成',         icon: '⚙️' },
];

export function Sidebar() {
  const { currentPhase, setPhase, logEntries, phase1Result, phase2Result, phase3Result } = useAppStore();

  const isUnlocked = (id: PhaseId): boolean => {
    if (id === 1) return true;
    if (id === 2) return true;
    if (id === 3) return logEntries.length > 0 || phase1Result !== null;
    if (id === 4) return phase2Result !== null;
    if (id === 5) return phase3Result !== null;
    return false;
  };

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col shadow-xl flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/logo_580_580.png"
            alt="Aisle"
            className="w-8 h-8 rounded-md object-cover flex-shrink-0"
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = 'none';
              const fb = t.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = 'flex';
            }}
          />
          <div
            className="w-8 h-8 rounded-md bg-indigo-500 items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ display: 'none' }}
          >
            A
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight truncate">Aisle</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {phases.map((phase) => {
          const unlocked = isUnlocked(phase.id);
          const active = currentPhase === phase.id;
          return (
            <button
              key={phase.id}
              onClick={() => unlocked && setPhase(phase.id)}
              disabled={!unlocked}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-md'
                  : unlocked
                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="text-xl w-7 text-center flex-shrink-0">{phase.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 flex-shrink-0">
                    {String(phase.id).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-sm truncate">{phase.label}</span>
                </div>
                <div className={`text-xs truncate ${active ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {phase.sublabel}
                </div>
              </div>
              {!unlocked && (
                <span className="ml-auto text-slate-600 text-xs flex-shrink-0">🔒</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* レポートボタン */}
      <div className="px-3 pb-3">
        <button
          onClick={() => setPhase(6)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all border ${
            currentPhase === 6
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
              : 'text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="text-xl w-7 text-center flex-shrink-0">📋</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm">総合レポート</div>
            <div className={`text-xs truncate ${currentPhase === 6 ? 'text-indigo-200' : 'text-slate-500'}`}>
              グラフ付き統合レポート
            </div>
          </div>
        </button>
      </div>

      {/* Admin リンク */}
      <div className="px-3 pb-2">
        <a
          href="/admin"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
        >
          <span className="text-lg w-7 text-center flex-shrink-0">🗂</span>
          <div className="min-w-0">
            <div className="font-semibold text-xs">管理画面</div>
            <div className="text-xs text-slate-600 truncate">Entity / Reference 管理</div>
          </div>
        </a>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 text-center">出現設計フレームワーク v1.0</div>
      </div>
    </aside>
  );
}
