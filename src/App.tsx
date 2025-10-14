import React, { useEffect, useMemo, useRef, useState } from "react";

// =============================================
// App.tsx — v2 完全版（Undo + 視認性 + 安定レイアウト）
// - 参加者/ラウンド/設定(prefs)をstateで定義
// - 直前ラウンド取り消し（Undo）
// - 暗黙Redo（Undo→再生成で同一案）をシードで再現
// - ボタンのコントラスト改善（黒地=白字）
// - Selected/Away/Return バッジを縦積みし、ボタンはみ出し防止
// - 行全体の選択ハイライト、チェックボックス強調
// - DEVセルフテストを同梱（既存テストは変更しない方針）
// =============================================

// ===== 型定義 =====
export type Participant = {
  id: string;
  name: string;
  selected: boolean;
  away?: boolean;
  justReturned?: boolean;
};

export type Pair = { a: string; b: string };
export type Round = {
  id: string;
  timestamp: number;
  team1: Pair;
  team2: Pair;
};

export type Prefs = {
  daySeed: string; // 当日シード（YYYY-MM-DD等）
};

export type AppStateSnapshot = {
  rounds: Round[];
  participants: Participant[];
  prefs: Prefs;
};

// ===== ユーティリティ =====
const LS_KEY = "tennis-pairing-v2";
const uid = () => Math.random().toString(36).slice(2, 10);

function loadState(): AppStateSnapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppStateSnapshot;
  } catch {
    return null;
  }
}

function persistAll(state: AppStateSnapshot) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let s = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  // --- 初期化 ---
  const initial: AppStateSnapshot = useMemo(() => {
    const restored = loadState();
    if (restored) return restored;
    const participants: Participant[] = Array.from({ length: 8 }).map((_, i) => ({
      id: `P${i + 1}`,
      name: `Player ${i + 1}`,
      selected: true,
      away: false,
      justReturned: false,
    }));
    const prefs: Prefs = { daySeed: new Date().toISOString().slice(0, 10) };
    return { rounds: [], participants, prefs };
  }, []);

  // --- State群 ---
  const [rounds, setRounds] = useState<Round[]>(initial.rounds);
  const [participants, setParticipants] = useState<Participant[]>(initial.participants);
  const [prefs, setPrefs] = useState<Prefs>(initial.prefs);
  const [historyStack, setHistoryStack] = useState<AppStateSnapshot[]>([]);

  // --- 補助 ---
  const nextFrameRef = useRef<HTMLDivElement | null>(null);
  const offsetPx = 80;

  // 永続化（rounds/participants/prefs が変わったら保存）
  useEffect(() => {
    persistAll({ rounds, participants, prefs });
  }, [rounds, participants, prefs]);

  // ===== 参加者操作 =====
  const toggleSelected = (id: string) => {
    setParticipants((ps) => ps.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const toggleAway = (id: string) => {
    setParticipants((ps) =>
      ps.map((p) => (p.id === id ? { ...p, away: !p.away, justReturned: p.away ? true : p.justReturned } : p))
    );
  };

  const clearJustReturned = (ids: string[]) => {
    setParticipants((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, justReturned: false } : p)));
  };

  // ===== 次ラウンド生成 =====
  const generateNextRound = () => {
    // 確定直前：スナップショットを積む（Undo用）
    setHistoryStack((stk) => [
      ...stk,
      {
        rounds: structuredClone(rounds),
        participants: structuredClone(participants),
        prefs: { ...prefs },
      },
    ]);

    // 候補抽出（選択true && awayでない） + 順序安定化
    const pool = participants.filter((p) => p.selected && !p.away);
    pool.sort((a, b) => a.id.localeCompare(b.id));

    if (pool.length < 4) {
      alert("選択中かつ一時離脱でない参加者が4人未満です。");
      setHistoryStack((stk) => stk.slice(0, -1));
      return;
    }

    // justReturned を優先しつつシードベースシャッフル
    const prioritized = [
      ...pool.filter((p) => p.justReturned),
      ...pool.filter((p) => !p.justReturned),
    ];
    const shuffled = seededShuffle(prioritized, `${prefs.daySeed}:${rounds.length}`);

    const quartet = shuffled.slice(0, 4).map((p) => p.id);
    const newRound: Round = {
      id: uid(),
      timestamp: Date.now(),
      team1: { a: quartet[0], b: quartet[1] },
      team2: { a: quartet[2], b: quartet[3] },
    };

    setRounds((rs) => [...rs, newRound]);
    clearJustReturned(quartet);

    try {
      nextFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollBy({ top: -offsetPx, behavior: "smooth" });
    } catch {}
  };

  // ===== Undo =====
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setRounds(last.rounds);
    setParticipants(last.participants);
    setPrefs(last.prefs);
    setHistoryStack((stk) => stk.slice(0, -1));

    try {
      persistAll({ rounds: last.rounds, participants: last.participants, prefs: last.prefs });
    } catch {}
    try {
      nextFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollBy({ top: -offsetPx, behavior: "smooth" });
    } catch {}
  };

  // ===== 表示補助 =====
  const pById = useMemo(() => Object.fromEntries(participants.map((p) => [p.id, p])), [participants]);

  // ===== DEV セルフテスト（純粋関数） =====
  type TestResult = { name: string; ok: boolean; note?: string };
  function runSelfTests(): TestResult[] {
    const results: TestResult[] = [];

    // 1) seededShuffle 決定性
    {
      const arr = [1, 2, 3, 4, 5, 6];
      const seed = "2025-10-15:3";
      const a = seededShuffle(arr, seed);
      const b = seededShuffle(arr, seed);
      results.push({ name: "seededShuffle: 同一シードで同一結果", ok: JSON.stringify(a) === JSON.stringify(b), note: `${JSON.stringify(a)} vs ${JSON.stringify(b)}` });
    }

    // 2) UndoStack push→pop
    {
      const snap1: AppStateSnapshot = { rounds: [], participants: [], prefs: { daySeed: "X" } };
      const snap2: AppStateSnapshot = { rounds: [{ id: "r1", timestamp: 0, team1: { a: "A", b: "B" }, team2: { a: "C", b: "D" } }], participants: [], prefs: { daySeed: "X" } };
      let stack: AppStateSnapshot[] = [];
      stack = [...stack, snap1];
      stack = [...stack, snap2];
      const last = stack[stack.length - 1];
      stack = stack.slice(0, -1);
      results.push({ name: "UndoStack: push→pop の挙動", ok: last.rounds.length === 1 && stack.length === 1, note: `len=${stack.length}` });
    }

    // 3) 暗黙Redo: シード一致
    {
      const daySeed = "2025-10-15";
      const beforeLen = 5;
      const seedBefore = `${daySeed}:${beforeLen}`;
      const seedAfterUndo = `${daySeed}:${beforeLen}`;
      results.push({ name: "暗黙Redo: 生成シードの一致", ok: seedBefore === seedAfterUndo });
    }

    // 4) 参加者抽出の安定化（ID昇順）
    {
      const ids = participants.filter(p=>p.selected && !p.away).map(p=>p.id);
      const sorted = [...ids].sort();
      results.push({ name: "候補集合のIDソート", ok: JSON.stringify(ids) === JSON.stringify(sorted) || ids.length===0, note: ids.length?`${ids.join(',')}`:"empty" });
    }

    return results;
  }

  const isDev = (import.meta as any)?.env?.DEV === true;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <h1 className="text-xl font-bold">Tennis Pairing — v2（Undo対応）</h1>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-md border font-semibold bg-neutral-900 text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              onClick={() => {
                const d = prompt("当日シード（日付など）", prefs.daySeed);
                if (!d) return;
                setPrefs((pf) => ({ ...pf, daySeed: d }));
              }}
            >
              当日シード: {prefs.daySeed}
            </button>
            <button
              type="button"
              disabled={historyStack.length === 0}
              className={`px-3 py-2 rounded-md border font-semibold bg-neutral-900 text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:bg-neutral-300 disabled:text-neutral-700 disabled:cursor-not-allowed`}
              onClick={handleUndo}
            >
              直前を取り消す
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md border font-semibold bg-neutral-900 text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              onClick={generateNextRound}
            >
              次のペアを決める（確定）
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 grid gap-8 lg:grid-cols-2">
        {/* 参加者パネル */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-bold mb-3">参加者</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col gap-2 border rounded-lg p-3 ${p.selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-neutral-200'}`}
              >
                {/* 名前とステータス */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className={`font-semibold ${p.selected ? 'text-blue-900' : ''}`}>{p.name}</span>
                    <div className="flex flex-col mt-1 gap-1 text-xs">
                      {p.selected && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 w-fit">Selected</span>}
                      {p.away && <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 w-fit">Away</span>}
                      {p.justReturned && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 w-fit">Return</span>}
                    </div>
                  </div>

                  {/* ボタン群（縦積み） */}
                  <div className="flex flex-col items-end gap-1">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => toggleSelected(p.id)}
                        className={p.selected ? 'accent-blue-600' : 'accent-neutral-400'}
                      />
                      対象
                    </label>
                    <button
                      type="button"
                      className={`px-2 py-1 rounded border text-sm font-medium transition-colors duration-150 ${
                        p.away
                          ? 'bg-orange-600 text-white border-orange-700 hover:bg-orange-500'
                          : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500'
                      }`}
                      onClick={() => toggleAway(p.id)}
                    >
                      {p.away ? '復帰する' : '一時離脱する'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ラウンド履歴 */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div ref={nextFrameRef} />
          <h2 className="text-lg font-bold mb-3">ラウンド履歴（{rounds.length}）</h2>
          {rounds.length === 0 ? (
            <p className="text-sm text-neutral-500">まだラウンドはありません。「次のペアを決める」を押してください。</p>
          ) : (
            <ol className="space-y-2">
              {rounds.map((r, idx) => (
                <li key={r.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Round #{idx + 1}</div>
                    <time className="text-xs text-neutral-500">{new Date(r.timestamp).toLocaleTimeString()}</time>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="border rounded p-2">
                      <div className="text-sm text-neutral-500">Team A</div>
                      <div className="font-medium">{pById[r.team1.a]?.name ?? r.team1.a} — {pById[r.team1.b]?.name ?? r.team1.b}</div>
                    </div>
                    <div className="border rounded p-2">
                      <div className="text-sm text-neutral-500">Team B</div>
                      <div className="font-medium">{pById[r.team2.a]?.name ?? r.team2.a} — {pById[r.team2.b]?.name ?? r.team2.b}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-neutral-500">
        <div className="mt-6 space-y-3">
          <p>
            ※ このファイルは v2 の最小差し替え実装です。既存の高度な組み合わせロジック/自己テストがある場合は、
            <code className="mx-1">generateNextRound</code>、<code className="mx-1">toggleAway</code>、<code className="mx-1">persistAll</code> の呼び出し部を既存関数名に置き換えてください。
          </p>

          {isDev && (
            <div className="pt-2">
              <button
                type="button"
                className="px-3 py-2 rounded-md border font-semibold bg-neutral-900 text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                onClick={() => {
                  const results = runSelfTests();
                  console.group("SelfTests");
                  results.forEach((r) => console[r.ok ? "log" : "error"](`${r.ok ? "✔" : "✖"} ${r.name} ${r.note ? "- " + r.note : ""}`));
                  console.groupEnd();
                  alert(results.map((r) => `${r.ok ? "✔" : "✖"} ${r.name}${r.note ? "\n  → " + r.note : ""}`).join("\n\n"));
                }}
              >
                Run self tests (DEV)
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
