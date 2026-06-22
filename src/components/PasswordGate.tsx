import { useState, useEffect, type ReactNode } from 'react';

const SESSION_KEY = 'aisle_authed';

// ─── 認証が必要な管理系パス（完全一致 or プレフィックス一致） ────────────
const PRIVATE_EXACT   = new Set(['/', '/dashboard', '/report', '/settings', '/admin']);
const PRIVATE_PREFIXES = ['/dashboard/', '/report/', '/settings/', '/admin/'];

/**
 * 認証が必要なパスかどうかを判定する。
 * - ルート `/` および管理系パス → true（認証必要）
 * - それ以外の単一スラグ（AI専用ページ） → false（公開）
 */
function isPrivatePath(pathname: string): boolean {
  if (PRIVATE_EXACT.has(pathname)) return true;
  if (PRIVATE_PREFIXES.some(p => pathname.startsWith(p))) return true;
  // 上記に該当しない単一・複数スラグは公開（AI専用ページ）
  return false;
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed]     = useState(false);
  const [input, setInput]       = useState('');
  const [show, setShow]         = useState(false);
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(true);

  // マウント時にセッション確認
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') setAuthed(true);
    setChecking(false);
  }, []);

  // ローディング中は何も表示しない（チラつき防止）
  if (checking) return null;

  const expected = import.meta.env.VITE_ACCESS_PASSWORD as string | undefined;

  // 環境変数未設定の場合はゲートをスキップ（開発時等）
  if (!expected || authed) return <>{children}</>;

  // 公開パス（AI専用ページなど）は認証スキップ
  const pathname = window.location.pathname;
  if (!isPrivatePath(pathname)) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === expected) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setAuthed(true);
    } else {
      setError('パスワードが正しくありません');
      setInput('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* ロゴ */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/favicon.png" alt="Aisle Studio" className="w-11 h-11 rounded-xl shadow-lg flex-shrink-0" />
          <div>
            <div className="font-bold text-white text-xl leading-tight">Aisle Studio</div>
            <div className="text-slate-400 text-xs leading-tight">AI出現を設計する</div>
          </div>
        </div>

        {/* カード */}
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <h1 className="text-white font-bold text-base mb-1">アクセス認証</h1>
          <p className="text-slate-400 text-sm mb-6">
            このアプリケーションはパスワードで保護されています。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* パスワード入力 */}
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={input}
                onChange={e => { setInput(e.target.value); setError(''); }}
                placeholder="パスワードを入力"
                autoFocus
                autoComplete="current-password"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-16"
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs px-1 py-0.5 rounded transition-colors"
              >
                {show ? '隠す' : '表示'}
              </button>
            </div>

            {/* エラー */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* ボタン */}
            <button
              type="submit"
              disabled={!input}
              className={`w-full font-semibold py-3 rounded-lg text-sm transition-all ${
                input
                  ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-md'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              入室する
            </button>
          </form>
        </div>

        {/* フッター */}
        <p className="text-center text-slate-600 text-xs mt-6">
          出現設計フレームワーク v1.0
        </p>
      </div>
    </div>
  );
}
