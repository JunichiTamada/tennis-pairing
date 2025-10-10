import { useState, useRef, useEffect } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ============================================================================
// ユーティリティ（日付・シード・永続化）
// ============================================================================
const STORAGE_KEY = "tdoubles_state_v1";
const PREF_KEY = "tdoubles_prefs_v1"; // 表示系プリファレンス（屋外モードなど）
// アプリのバージョン表示用（設定カード右上）
const APP_VERSION = "v1.0.0";

// 初期登録メンバー（常にここが正として起動時に必ず反映される）
const INITIAL_PARTICIPANTS = [
  { id: 1, name: "浅野", gender: "男", selected: false, away: false, justReturned: false },
  { id: 2, name: "加藤", gender: "男", selected: false, away: false, justReturned: false },
  { id: 3, name: "奥山", gender: "男", selected: false, away: false, justReturned: false },
  { id: 4, name: "大山", gender: "男", selected: false, away: false, justReturned: false },
  { id: 5, name: "玉田", gender: "男", selected: false, away: false, justReturned: false },
  { id: 6, name: "宮原ひろ", gender: "男", selected: false, away: false, justReturned: false },
  { id: 7, name: "宮原む", gender: "女", selected: false, away: false, justReturned: false },
  { id: 8, name: "根津", gender: "男", selected: false, away: false, justReturned: false },
  { id: 9, name: "小柳", gender: "男", selected: false, away: false, justReturned: false },
  { id: 10, name: "島村", gender: "男", selected: false, away: false, justReturned: false },
  { id: 11, name: "伊豆丸", gender: "女", selected: false, away: false, justReturned: false },
  { id: 12, name: "相原", gender: "女", selected: false, away: false, justReturned: false },
];

// ローカルタイムの YYYY-MM-DD を返す（UTCではなく端末ローカル）
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 文字列→32bit シード化（FNV-1a 簡易版）
function strToSeed(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 参照：mulberry32（シンプルで十分な擬似乱数）
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0,1)
  };
}

// ============================================================================
// ヘルパー関数群（組合せ生成・同一判定など）
// ============================================================================

// n個の配列からk個を選ぶ組合せ（順不同）をすべて返す
function combinations(arr: any[], k: number) {
  const res: any[][] = [];
  const dfs = (start: number, path: any[]) => {
    if (path.length === k) {
      res.push([...path]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      dfs(i + 1, path);
      path.pop();
    }
  };
  dfs(0, []);
  return res;
}

// 4人を2ペア×2に分けるパターンは3通り
function pairingsOfFour([a, b, c, d]: any[]) {
  return [
    { pairA: [a, b], pairB: [c, d] },
    { pairA: [a, c], pairB: [b, d] },
    { pairA: [a, d], pairB: [b, c] },
  ];
}

// {x,y} と {y,x} を同一ペアとして扱う
function samePair(p1: any[], p2: any[]) {
  const ids1 = [p1[0].id, p1[1].id].sort();
  const ids2 = [p2[0].id, p2[1].id].sort();
  return ids1[0] === ids2[0] && ids1[1] === ids2[1];
}

// メンバー集合（idの集合）が等しいか
function setEqualIds(a: any[], b: any[]) {
  const s1 = new Set(a.map((x) => x.id));
  const s2 = new Set(b.map((x) => x.id));
  if (s1.size !== s2.size) return false;
  for (const v of s1) if (!s2.has(v)) return false;
  return true;
}

// ペア（id2つ）を一意に識別するキー（順不同）
const key2 = (id1: number, id2: number) => {
  const a = Math.min(id1, id2);
  const b = Math.max(id1, id2);
  return `${a}-${b}`;
};

// 当日の履歴から「同一ペア回数」「個人vs個人の対戦回数」を集計
function buildStats(rounds: any[]) {
  const partnerCount = new Map<string, number>();
  const opponentCount = new Map<string, number>();

  for (const r of rounds) {
    const [a1, a2] = r.pairA;
    const [b1, b2] = r.pairB;

    // 同一ペア回数
    partnerCount.set(
      key2(a1.id, a2.id),
      (partnerCount.get(key2(a1.id, a2.id)) || 0) + 1
    );
    partnerCount.set(
      key2(b1.id, b2.id),
      (partnerCount.get(key2(b1.id, b2.id)) || 0) + 1
    );

    // 対戦回数（個人vs個人の4パターン）
    const oppPairs = [
      [a1.id, b1.id],
      [a1.id, b2.id],
      [a2.id, b1.id],
      [a2.id, b2.id],
    ];
    for (const [x, y] of oppPairs) {
      opponentCount.set(key2(x, y), (opponentCount.get(key2(x, y)) || 0) + 1);
    }
  }
  return { partnerCount, opponentCount };
}

// 直前ラウンドと同じ4人構成で、ペアを反転しただけ（AB vs CD → BA vs DC）なら禁止
function isForbiddenFlipGivenPrev(prev: any | null, candidate: any) {
  if (!prev) return false;
  const prevPlayers = [...prev.pairA, ...prev.pairB];
  const candPlayers = [...candidate.pairA, ...candidate.pairB];
  if (!setEqualIds(prevPlayers, candPlayers)) return false;
  return (
    samePair(candidate.pairA, prev.pairB) &&
    samePair(candidate.pairB, prev.pairA)
  );
}

// ============================================================================
// ヘルプ表示（重みの意味など）
// ============================================================================
function HelpContent() {
  return (
    <ErrorBoundary>
      <div className="space-y-3 text-sm leading-6">
        <p className="font-semibold">重みが結果に与える影響</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>同一ペア重み (wPartner)</strong>：同じ2人の再ペアを避けたいほど値を上げる。
          </li>
          <li>
            <strong>同一対戦重み (wOpp)</strong>：同じ相手と当たり続けるのを避けたいほど値を上げる。
          </li>
          <li>
            <strong>直前類似ペナ (wPrev)</strong>：直前ラウンドと似た配置を避けたいほど値を上げる。
          </li>
        </ul>
        <p className="font-semibold">ハード制約</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>AB vs CD → BA vs DC の<strong>反転禁止</strong>は常に適用。</li>
          <li><strong>連続休み回避</strong>は固定値ペナルティ（現状 +5）。</li>
        </ul>
        <p className="font-semibold">補足</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>同じ参加者でも<strong>初回の組み合わせはランダムで変わります</strong>。</li>
          <li>今日のラウンド履歴はアプリを閉じても<strong>自動的に保存</strong>されます。翌日になると自動で新しく始まります。やり直したいときは「今日の状態を消去」を押してください。</li>
        </ul>
      </div>
    </ErrorBoundary>
  );
}

// ============================================================================
// メインコンポーネント
// 予防線：ランタイム例外時に真っ白化を防ぐ簡易エラーバウンダリ（Android Chrome実機対策を含む）
class ErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; message: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || err) };
  }
  componentDidCatch(err: any, info: any) {
    try { console.error("ErrorBoundary caught:", err, info); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 max-w-md mx-auto">
          <div className="rounded border border-red-300 bg-red-50 text-red-900 p-3">
            <p className="font-semibold mb-1">エラーが発生しました</p>
            <p className="text-sm break-words">{this.state.message}</p>
            <p className="text-xs text-red-800 mt-2">ページを再読み込みしてください。</p>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

// ============================================================================
export default function TennisAppPrototype() {
  // 屋外（高輝度）モード：ONのときは OS ダーク設定に関係なくライト配色に固定
  const [outdoorMode, setOutdoorMode] = useState(true); // 初期値をON（白背景・高輝度）

  // 端末ダーク設定の影響を無効化（常にライトベース）
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.remove("dark");
  }, [outdoorMode]);

  // 隠しコマンド：URL 末尾に #test で自己テスト（キーボードショートカットは廃止）
  useEffect(() => {
    if (location.hash === '#test') {
      try { runSelfTests(); } catch {}
    }
  }, []);

  // --- 状態管理 -------------------------------------------------------------
  const [participants, setParticipants] = useState(INITIAL_PARTICIPANTS);

  const [rounds, setRounds] = useState<any[]>([]); // ラウンド履歴
  const [showHelp, setShowHelp] = useState(false); // ヘルプ表示フラグ
  const [testResults, setTestResults] = useState<string[]>([]); // 自己テスト結果
  
  // 隠しコマンド用：バージョン表示を 5 回タップで自己テスト起動（2 秒以内の連打）
  const [verTapCount, setVerTapCount] = useState(0);
  const verTapTimer = useRef<number | null>(null);
  const onVersionTap = () => {
    try { if (verTapTimer.current) window.clearTimeout(verTapTimer.current); } catch {}
    setVerTapCount((c) => {
      const n = c + 1;
      if (n >= 5) {
        try { runSelfTests(); } catch {}
        return 0; // リセット
      }
      try {
        verTapTimer.current = window.setTimeout(() => setVerTapCount(0), 2000) as unknown as number;
      } catch {}
      return n;
    });
  };

  // スコア重み（当日履歴全体に基づく）
  const [wPartner, setWPartner] = useState(2);
  const [wOpp, setWOpp] = useState(1);
  const [wPrev, setWPrev] = useState(1);

  // シード由来の乱数（本日の日付で固定）。同日の再起動でも同一順序を再現可能。
  const randRef = useRef<() => number>(mulberry32(strToSeed(todayStr())));

  // 長押し判定用（スマホ）
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const longPressFired = useRef<Record<number, boolean>>({});
  const LONG_PRESS_MS = 500;

  // ========= 自動スクロール（最新ラウンド/操作位置へ） =========
  const latestRef = useRef<HTMLDivElement | null>(null);
  const participantRef = useRef<HTMLHeadingElement | null>(null);
  const nextFrameRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (rounds.length > 0) {
      const target = nextFrameRef.current || participantRef.current || latestRef.current;
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY;
        // Android Chrome では稀に smooth で描画が不安定になるケースがあるためフォールバック
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isAndroidChrome = /Android/i.test(ua) && /Chrome/i.test(ua);
        const behavior: ScrollBehavior = isAndroidChrome ? 'auto' : 'smooth';
        requestAnimationFrame(() => {
          try {
            window.scrollTo({ top: Math.max(0, top - 8), behavior });
          } catch {
            window.scrollTo(0, Math.max(0, top - 8));
          }
        });
      }
    }
  }, [rounds.length]);
  // ==========================================================

  // 表示名（登録名 + さん）
  const displayName = (p: { name: string }) => `${p.name}さん`;

  // --- 起動時に localStorage から復元（本日データのみ） --------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.date === todayStr()) {
        // --- マイグレーション：保存された参加者に初期メンバーを必ず反映する ---
        const restored: any[] = Array.isArray(saved.participants) ? [...saved.participants] : [];
        const byId = new Map<number, any>(restored.map((p: any) => [p.id, { ...p }]));
        // 初期メンバーを必ず存在させ、名前/性別の更新も反映
        for (const base of INITIAL_PARTICIPANTS) {
          const cur = byId.get(base.id);
          if (cur) {
            cur.name = base.name;      // 名前を最新に同期
            cur.gender = base.gender;  // 性別も同期
            // 型安全のため既存フラグを正規化
            cur.selected = !!cur.selected;
            cur.away = !!cur.away;
            cur.justReturned = !!cur.justReturned && !!cur.selected;
            byId.set(base.id, cur);
          } else {
            byId.set(base.id, { ...base });
          }
        }
        // 既存に初期外のメンバー（将来の拡張やゲスト保存）があっても保持
        const merged = Array.from(byId.values()).sort((a,b)=>a.id-b.id);
        setParticipants(merged);
        if (Array.isArray(saved.rounds)) setRounds(saved.rounds);
        if (typeof saved.wPartner === "number") setWPartner(saved.wPartner);
        if (typeof saved.wOpp === "number") setWOpp(saved.wOpp);
        if (typeof saved.wPrev === "number") setWPrev(saved.wPrev);
      }
    } catch (e) {
      console.warn("failed to restore state", e);
    }
  }, []);

  // 屋外モードの復元（起動時）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PREF_KEY);
      if (raw) {
        const pref = JSON.parse(raw);
        if (typeof pref?.outdoorMode === "boolean") setOutdoorMode(pref.outdoorMode);
      }
    } catch {}
  }, []);

  // --- 自動保存（常に：同日内の再現のため） --------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      date: todayStr(),
      participants,
      rounds,
      wPartner,
      wOpp,
      wPrev,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [participants, rounds, wPartner, wOpp, wPrev]);

  // 屋外モードの保存
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify({ outdoorMode }));
    } catch {}
  }, [outdoorMode]);

  // 手動で「今日の状態を消去」→ 新規やり直し（モーダルで確認）
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 実処理：当日の状態をクリア
  const doClearToday = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}

    // ラウンド・選択状態をリセットし、重みもデフォルトに戻す
    setRounds([]);
    // 初期メンバーに完全リセット
    setParticipants(INITIAL_PARTICIPANTS.map((p) => ({ ...p })));
    setWPartner(2);
    setWOpp(1);
    setWPrev(1);

    setConfirmOpen(false);
  };

  // クリックでモーダルを開く
  const clearToday = () => {
    setConfirmOpen(true);
  };

  // 重みだけをデフォルトに戻す
  const resetWeights = () => {
    setWPartner(2);
    setWOpp(1);
    setWPrev(1);
  };

  // --- 参加者選択・一時離脱ハンドラ -----------------------------------------
  const toggleParticipant = (id: number) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        // ① 非選択 → 選択 にする場合
        if (!p.selected) {
          // 直前まで離脱中だった場合は、復帰フラグを立てる
          if (p.away) {
            return { ...p, selected: true, away: false, justReturned: true };
          }
          return { ...p, selected: true, away: false, justReturned: p.justReturned };
        }
        // ② 選択 → 非選択（解除）にする場合：復帰マークは消す
        return { ...p, selected: false, justReturned: false };
      })
    );
  };

  const toggleAway = (id: number) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        // 復帰：justReturned を付け、自動選択に戻す（※今回の仕様では基本タップで復帰する想定）
        if (p.away) return { ...p, away: false, selected: true, justReturned: true };
        // 離脱：選択中のみ許可。非選択は無反応。
        if (!p.selected) return p;
        return { ...p, away: true, selected: false, justReturned: false };
      })
    );
  };

  const startLongPress = (id: number) => {
    // 非選択は長押しの対象外（無反応）
    const target = participants.find((x) => x.id === id);
    if (!target || !target.selected) {
      longPressFired.current[id] = false;
      clearTimeout(timers.current[id]);
      return;
    }
    longPressFired.current[id] = false;
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      longPressFired.current[id] = true;
      toggleAway(id);
    }, LONG_PRESS_MS);
  };

  const endLongPress = (id: number) => {
    clearTimeout(timers.current[id]);
  };

  // PCでは右クリックで一時離脱トグル
  const handleMouseDown = (id: number, e: any) => {
    if (e && e.type === "contextmenu") {
      e.preventDefault();
      const target = participants.find((x) => x.id === id);
      // 右クリックも、選択中のみ一時離脱トグルを許可
      if (target && target.selected) {
        toggleAway(id);
      }
    }
  };

  const handleNameClick = (id: number) => {
    // 長押し後のクリックは無視（ダブルトリガー防止）
    if (longPressFired.current[id]) {
      longPressFired.current[id] = false;
      return;
    }
    toggleParticipant(id);
  };

  // 直前ラウンド取得
  const lastRound = () => rounds[rounds.length - 1];

  // 反転禁止（直前ラウンドのみ厳密禁止）
  const isForbiddenFlip = (candidate: any) => {
    const prev = lastRound();
    return isForbiddenFlipGivenPrev(prev, candidate);
  };

  // 直前に似た配置への軽いペナルティ
  const pairingPenaltyVsPrev = (candidate: any) => {
    const prev = lastRound();
    if (!prev) return 0;
    let pen = 0;
    if (
      samePair(candidate.pairA, prev.pairA) ||
      samePair(candidate.pairA, prev.pairB)
    )
      pen += 1;
    if (
      samePair(candidate.pairB, prev.pairA) ||
      samePair(candidate.pairB, prev.pairB)
    )
      pen += 1;
    const sameOpp =
      setEqualIds(candidate.pairA, prev.pairA) &&
      setEqualIds(candidate.pairB, prev.pairB);
    const sameOppRev =
      setEqualIds(candidate.pairA, prev.pairB) &&
      setEqualIds(candidate.pairB, prev.pairA);
    if (sameOpp || sameOppRev) pen += 1;
    return pen * wPrev;
  };

  // 候補スコア（小さいほど良い）
  const scoreByHistory = (candidate: any, rest: any[], counts: any) => {
    const { partnerCount, opponentCount } = counts;
    let score = 0;

    // 同一ペアの累積回数（重み wPartner）
    const [a1, a2] = candidate.pairA;
    const [b1, b2] = candidate.pairB;
    score += (partnerCount.get(key2(a1.id, a2.id)) || 0) * wPartner;
    score += (partnerCount.get(key2(b1.id, b2.id)) || 0) * wPartner;

    // 個人vs個人の対戦回数（重み wOpp）
    const oppPairs = [
      [a1.id, b1.id],
      [a1.id, b2.id],
      [a2.id, b1.id],
      [a2.id, b2.id],
    ];
    for (const [x, y] of oppPairs) {
      score += (opponentCount.get(key2(x, y)) || 0) * wOpp;
    }

    // 直前類似ペナルティ（重み wPrev）
    score += pairingPenaltyVsPrev(candidate);

    // 連続休みペナルティ（直前に休んだ人を再び休ませたら +5）
    const prev = lastRound();
    const lastRestIds = new Set(prev ? prev.rest.map((m: any) => m.id) : []);
    for (const r of rest) if (lastRestIds.has(r.id)) score += 5;

    return score;
  };

  // ラウンド生成（最小スコアの組合せを採用）
  const generateRound = () => {
    try {
      // 1) アクティブかつ選択中のみ抽出
      let pool = participants.filter((p) => p.selected && !p.away);
      if (pool.length < 4) {
        alert("4名以上を選択してください");
        return;
      }

      // 2) 並び替え：復帰者を最優先、直前休みは後方へ
      const prev = lastRound();
      const lastRestIds = new Set(prev ? prev.rest.map((x: any) => x.id) : []);
      pool = [...pool].sort((a, b) => {
        const r = Number(b.justReturned) - Number(a.justReturned);
        if (r !== 0) return r;
        const aLastRest = lastRestIds.has(a.id) ? 1 : 0;
        const bLastRest = lastRestIds.has(b.id) ? 1 : 0;
        return aLastRest - bLastRest;
      });

      // 3) 当日履歴の集計
      const counts = buildStats(rounds);

      // 4) 4人組の候補（最大200件）に対して3通りのペアリングを評価
      const quads = combinations(pool, 4).slice(0, 200);

      // ★ 同点最良候補からランダム（当日シードで再現性あり）
      let bestScore = Number.POSITIVE_INFINITY;
      let bestCandidates: any[] = [];

      for (const quad of quads) {
        const quadIds = new Set(quad.map((x) => x.id));
        const rest = pool.filter((p) => !quadIds.has(p.id));
        for (const pairing of pairingsOfFour(quad)) {
          if (isForbiddenFlip(pairing)) continue; // 反転禁止
          const score = scoreByHistory(pairing, rest, counts);
          if (score < bestScore - 1e-9) {
            bestScore = score;
            bestCandidates = [{ match: { ...pairing, rest }, score }];
          } else if (Math.abs(score - bestScore) <= 1e-9) {
            bestCandidates.push({ match: { ...pairing, rest }, score });
          }
        }
      }

      if (bestCandidates.length === 0) {
        alert("候補が見つかりません。休憩者や選択を調整してください。");
        return;
      }

      const idx = Math.floor(randRef.current() * bestCandidates.length);
      const chosen = bestCandidates[idx];

      // 5) 採用＆状態更新（復帰フラグを消費）
      setRounds((prevRounds) => [...prevRounds, chosen.match]);
      const chosenIds = new Set(
        [...chosen.match.pairA, ...chosen.match.pairB].map((c: any) => c.id)
      );
      setParticipants((prevParts) =>
        prevParts.map((p) => (chosenIds.has(p.id) ? { ...p, justReturned: false } : p))
      );
    } catch (e) {
      try { console.error('generateRound error:', e); } catch {}
      alert('エラーが発生しました。ページを再読み込みしてください。');
    }
  };

  // ========================================================================
  // 簡易自己テスト（UI非表示／隠しコマンドで実行）
  // ========================================================================
  function runSelfTests() {
    const results: string[] = [];
    try {
      // T1: combinations 基本
      const c1 = combinations([1, 2, 3, 4], 4);
      const c2 = combinations([1, 2, 3, 4, 5], 4);
      results.push(
        `[T1] combinations length ok: ${c1.length === 1 && c2.length === 5}`
      );

      // T2: pairingsOfFour は常に3通り
      const dummy = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const ps = pairingsOfFour(dummy);
      results.push(`[T2] pairingsOfFour returns 3: ${ps.length === 3}`);

      // T3: samePair の対称性
      results.push(
        `[T3] samePair symmetric: ${samePair(
          [{ id: 1 }, { id: 2 }],
          [{ id: 2 }, { id: 1 }]
        ) === true}`
      );

      // T4: setEqualIds の正否
      const seTrue = setEqualIds(
        [{ id: 1 }, { id: 2 }],
        [{ id: 2 }, { id: 1 }]
      );
      const seFalse = setEqualIds(
        [{ id: 1 }, { id: 2 }],
        [{ id: 2 }, { id: 3 }]
      );
      results.push(
        `[T4] setEqualIds works: ${seTrue === true && seFalse === false}`
      );

      // T5/T6: 反転禁止の検出/非検出（同一4名）
      const prev = {
        pairA: [{ id: 1 }, { id: 2 }],
        pairB: [{ id: 3 }, { id: 4 }],
        rest: [],
      };
      const candFlip = {
        pairA: [{ id: 3 }, { id: 4 }],
        pairB: [{ id: 1 }, { id: 2 }],
      };
      const candNotFlip = {
        pairA: [{ id: 1 }, { id: 3 }],
        pairB: [{ id: 2 }, { id: 4 }],
      };
      results.push(
        `[T5] flip detected: ${
          isForbiddenFlipGivenPrev(prev, candFlip) === true
        }`
      );
      results.push(
        `[T6] non-flip allowed: ${
          isForbiddenFlipGivenPrev(prev, candNotFlip) === false
        }`
      );

      // T7: buildStats のパートナー回数集計
      const roundsMock = [prev];
      const counts = buildStats(roundsMock);
      const repeatPartner =
        (counts.partnerCount.get(key2(1, 2)) || 0) +
        (counts.partnerCount.get(key2(3, 4)) || 0);
      const newPartner =
        (counts.partnerCount.get(key2(1, 3)) || 0) +
        (counts.partnerCount.get(key2(2, 4)) || 0);
      results.push(
        `[T7] partnerCount higher for repeat: ${repeatPartner > newPartner}`
      );

      // T8: buildStats の対戦回数（4通りが1回）
      const oc = counts.opponentCount;
      const t8 =
        (oc.get(key2(1, 3)) || 0) === 1 &&
        (oc.get(key2(1, 4)) || 0) === 1 &&
        (oc.get(key2(2, 3)) || 0) === 1 &&
        (oc.get(key2(2, 4)) || 0) === 1;
      results.push(`[T8] opponentCount per round: ${t8}`);

      // T9: scoreByHistory がペア再現候補に高スコアを与える（wPartner>0想定）
      const candidateRepeat = {
        pairA: [{ id: 1 }, { id: 2 }],
        pairB: [{ id: 3 }, { id: 4 }],
      };
      const candidateNew = {
        pairA: [{ id: 1 }, { id: 3 }],
        pairB: [{ id: 2 }, { id: 4 }],
      };
      const sRepeat = scoreByHistory(candidateRepeat, [], counts);
      const sNew = scoreByHistory(candidateNew, [], counts);
      results.push(`[T9] repeat pairing scored higher: ${sRepeat > sNew}`);

      // T10: 同点最良候補の収集（履歴が無いとき、4人固定なら最大3候補が同点になり得る）
      const noHistCounts = buildStats([]);
      const four = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ];
      const bestScores = pairingsOfFour(four).map((p) =>
        scoreByHistory(p as any, [], noHistCounts)
      );
      const min = Math.min(...bestScores);
      const ties = bestScores.filter((s) => Math.abs(s - min) <= 1e-9).length;
      results.push(`[T10] ties exist on empty history: ${ties >= 1}`);

      // T11: 乱数のシード固定（同じ日付シードで同じ系列が得られる）
      const r1 = mulberry32(strToSeed("2025-01-02"));
      const r2 = mulberry32(strToSeed("2025-01-02"));
      const seq1 = [r1(), r1(), r1()].join(",");
      const seq2 = [r2(), r2(), r2()].join(",");
      results.push(`[T11] seeded RNG reproducible: ${seq1 === seq2}`);

      // T12: 別日シードは異なる系列（高確率で異なる）
      const r3 = mulberry32(strToSeed("2025-01-03"));
      const seq3 = [r3(), r3(), r3()].join(",");
      results.push(
        `[T12] different seed produces different seq (likely): ${
          seq1 !== seq3
        }`
      );

      // T13: 反転検出（同一4名・ペア配列の順序が入れ替わっていても検出される）
      const candFlip2 = {
        pairA: [{ id: 4 }, { id: 3 }], // prev.pairB の逆順
        pairB: [{ id: 2 }, { id: 1 }], // prev.pairA の逆順
      };
      results.push(
        `[T13] flip detected even with reversed pair orders: ${
          isForbiddenFlipGivenPrev(prev, candFlip2) === true
        }`
      );

      // T14: 全く別の4名になった場合は反転禁止は不適用（false）
      const prev2 = {
        pairA: [{ id: 5 }, { id: 6 }],
        pairB: [{ id: 7 }, { id: 8 }],
        rest: [],
      };
      const candWithDifferentSet = {
        pairA: [{ id: 1 }, { id: 2 }],
        pairB: [{ id: 3 }, { id: 4 }],
      };
      results.push(
        `[T14] flip rule disabled for different 4 players: ${
          isForbiddenFlipGivenPrev(prev2, candWithDifferentSet) === false
        }`
      );

      // T15: key2 は順序に依存しない
      results.push(`[T15] key2 order-insensitive: ${key2(2,5) === key2(5,2)}`);

      // T16: prev が null のときは反転禁止は働かない
      const candAny = { pairA: [{ id: 1 }, { id: 2 }], pairB: [{ id: 3 }, { id: 4 }] };
      results.push(`[T16] flip check with null prev: ${isForbiddenFlipGivenPrev(null, candAny) === false}`);

      // T17: setEqualIds は要素数が違えば false
      results.push(`[T17] setEqualIds size mismatch: ${setEqualIds([{id:1}], [{id:1},{id:2}]) === false}`);

      // T18: pairingsOfFour の3案は互いに異なる
      const uniq = new Set(
        pairingsOfFour(dummy).map((p) =>
          [
            key2(p.pairA[0].id, p.pairA[1].id),
            key2(p.pairB[0].id, p.pairB[1].id),
          ]
            .sort()
            .join("|")
        )
      );
      results.push(`[T18] pairings are unique: ${uniq.size === 3}`);
    } catch (e: any) {
      results.push(`[ERROR] ${e?.message || e}`);
    }
    setTestResults(results);
  }

  // ========================================================================
  // レンダリング（屋外:白 / 屋内:濃いグレー基調）
  // ========================================================================
  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${outdoorMode ? 'bg-white' : 'bg-neutral-500'} text-gray-900`}>
        <div className="p-4 max-w-md mx-auto space-y-6">
          {/* 設定カード */}
          <Card className={`border border-neutral-300 ${outdoorMode ? 'bg-white' : 'bg-neutral-500'} shadow-sm`}>
            <CardContent className="p-4 space-y-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-black">設定</h2>
                <span
                  className="text-xs font-medium text-black/70 select-none"
                  title="バージョンを5回タップで自己テスト"
                  onClick={onVersionTap}
                >
                  {APP_VERSION}
                </span>
              </div>

              {/* 上段：屋外モード + 重みリセット */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={`basis-1/2 min-w-0 truncate justify-center px-3 whitespace-nowrap font-semibold shadow-sm border ${
                    outdoorMode
                      ? "!bg-amber-400 !text-black !border-amber-500 hover:!bg-amber-500"
                      : "!bg-white !text-black !border !border-neutral-400 hover:!bg-neutral-100"
                  }`}
                  onClick={() => setOutdoorMode((v) => !v)}
                >
                  {`屋外モード: ${outdoorMode ? 'On' : 'Off'}`}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className={`basis-1/2 min-w-0 truncate justify-center px-3 w-auto shrink-0 whitespace-nowrap font-semibold !border hover:!bg-neutral-100 shadow-sm !bg-white !text-black !border-neutral-400`}
                  onClick={resetWeights}
                >
                  <span className="sm:hidden" aria-label="重みをデフォルトに戻す">重みを初期化</span>
                  <span className="hidden sm:inline">重みをデフォルトに戻す</span>
                </Button>
              </div>

              {/* 下段：ヘルプ + 今日の状態を消去 */}
              <div className="flex items-center text-sm gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowHelp((v) => !v)}
                  className={`basis-1/2 min-w-0 truncate justify-center px-3 w-auto shrink-0 font-semibold !border shadow-sm whitespace-nowrap !bg-white !text-black !border-neutral-400 hover:!bg-neutral-100`}
                >
                  {showHelp ? "ヘルプを閉じる" : "ヘルプ"}
                </Button>

                <Button
                  type="button"
                  className="basis-1/2 min-w-0 truncate justify-center px-3 w-auto shrink-0 whitespace-nowrap font-semibold !bg-red-600 !text-white hover:!bg-red-700 shadow-sm"
                  onClick={clearToday}>
                  <span className="sm:hidden" aria-label="今日の状態を消去（新規開始）">今日の状態を消去</span>
                  <span className="hidden sm:inline">今日の状態を消去（新規開始）</span>
                </Button>
              </div>

              {/* 自己テスト結果（隠しコマンドで起動） */}
              {testResults.length > 0 && (
                <div className="text-xs bg-gray-50 border border-neutral-300 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold m-0">Self-test results</p>
                    <Button
                      variant="ghost"
                      className={`h-6 px-2 text-xs rounded ${
                        outdoorMode
                          ? "!bg-black !text-white hover:!bg-neutral-800"
                          : "!text-white hover:!bg-neutral-700 !border !border-white/30"
                      }`}
                      onClick={() => setTestResults([])}
                    >
                      閉じる
                    </Button>
                  </div>
                  <ul className="list-disc pl-5 mt-1">
                    {testResults.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showHelp && (
                <div className={`mt-2 p-3 rounded-lg border border-neutral-300 ${outdoorMode ? 'bg-white/90' : 'bg-neutral-500/90'}`}>
                  <HelpContent />
                </div>
              )}

              {/* 重みスライダー */}
              <div className="text-sm grid grid-cols-1 gap-3">
                <label className="flex items-center gap-3 text-black">
                  <span className="w-40 text-black">同一ペア重み</span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={wPartner}
                    onChange={(e) => setWPartner(Number(e.target.value))}
                    className="flex-1 accent-blue-700"
                  />
                  <span className="w-8 text-right text-black">{wPartner}</span>
                </label>
                <label className="flex items-center gap-3 text-black">
                  <span className="w-40 text-black">同一対戦重み</span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={wOpp}
                    onChange={(e) => setWOpp(Number(e.target.value))}
                    className="flex-1 accent-blue-700"
                  />
                  <span className="w-8 text-right text-black">{wOpp}</span>
                </label>
                <label className="flex items-center gap-3 text-black">
                  <span className="w-40 text-black">直前類似ペナ</span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={wPrev}
                    onChange={(e) => setWPrev(Number(e.target.value))}
                    className="flex-1 accent-blue-700"
                  />
                  <span className="w-8 text-right text-black">{wPrev}</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 参加者選択 */}
          <Card className={`border border-neutral-300 ${outdoorMode ? 'bg-white' : 'bg-neutral-500'} shadow-sm`}>
            <CardContent className="p-4">
              <h2 ref={participantRef} className="text-lg font-bold mb-2">参加者を選択</h2>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleNameClick(p.id)}
                    onContextMenu={(e) => handleMouseDown(p.id, e)}
                    onTouchStart={() => startLongPress(p.id)}
                    onTouchEnd={() => endLongPress(p.id)}
                    onTouchCancel={() => endLongPress(p.id)}
                    className={`appearance-none px-3 py-2 rounded-full border text-sm flex items-center gap-1 ${
                      p.away
                        ? (outdoorMode
                            ? "!bg-yellow-400 !text-black !border-yellow-500"
                            : "!bg-yellow-300 !text-black !border !border-yellow-500 font-semibold")
                        : p.selected
                        ? (outdoorMode ? "!bg-sky-600 !text-white !border-sky-700" : "!bg-black !text-neutral-200 !border !border-black font-semibold")
                        : (outdoorMode
                            ? "!bg-white !text-black !border !border-neutral-300 shadow-sm"
                            : "!bg-white !text-black !border !border-neutral-300 shadow-sm")
                    }`}
                  >
                    {displayName(p)}
                    {p.away && <span className="text-xs font-semibold text-red-700">(離脱中)</span>}
                    {p.justReturned && !p.away && (
                      <span className="text-[10px] ml-1">★復帰</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-900 mt-2">
                ヒント：タップ=選択/解除・長押し=一時離脱（スマホ）・右クリック=一時離脱（PC）
              </p>
            </CardContent>
          </Card>

          {/* 次ラウンド決定（単独フレーム） */}
          <Card ref={nextFrameRef} className={`border border-neutral-300 ${outdoorMode ? 'bg-white' : 'bg-neutral-500'} shadow-sm`}>
            <CardContent className="!p-2">
              <div>
                <Button
                  size="sm"
                  className={`w-full appearance-none !h-9 !py-2 font-semibold ${
                    outdoorMode
                      ? "!bg-sky-600 !text-white hover:!bg-sky-700"
                      : "!bg-neutral-900 !text-white hover:!bg-neutral-800"
                  }`}
                  onClick={generateRound}
                >
                  次のペアを決める
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ラウンド履歴（最新を上に表示） */}
          {rounds.length > 0 && (
            <Card className={`border border-neutral-300 ${outdoorMode ? 'bg-white' : 'bg-neutral-500'} shadow-sm`}>
              <CardContent className="p-4">
                <h2 className="text-lg font-bold mb-2">ラウンド履歴</h2>
                {rounds
                  .map((r, idx) => ({ r, idx }))
                  .reverse()
                  .map(({ r, idx }) => {
                    const isLatest = idx === rounds.length - 1;
                    return (
                      <div
                        ref={isLatest ? latestRef : undefined}
                        key={idx}
                        className={`mb-3 ${
                          isLatest
                            ? "bg-blue-50 border-l-4 border-blue-500 p-2 rounded"
                            : ""
                        }`}
                      >
                        <p
                          className={`font-semibold ${
                            isLatest ? "text-lg text-blue-800" : ""
                          }`}
                        >
                          第{idx + 1}ラウンド {isLatest && "(最新)"}
                        </p>
                        {/* 3行表示：1行目=ペアA / 2行目=vs / 3行目=ペアB */}
                        <div className={`${isLatest ? "text-blue-900" : ""} text-center`}>
                          <p className={`${isLatest ? "text-xl font-bold" : ""}`}>{r.pairA.map((p: any) => displayName(p)).join("・")}</p>
                          <p className={`my-0.5 font-bold ${isLatest ? "text-2xl" : "text-base"}`}>vs</p>
                          <p className={`${isLatest ? "text-xl font-bold" : ""}`}>{r.pairB.map((p: any) => displayName(p)).join("・")}</p>
                        </div>
                        {r.rest.length > 0 && (
                          <p
                            className={`text-sm ${
                              isLatest ? "text-blue-700" : "text-gray-700"
                            }`}
                          >
                            休憩: {r.rest.map((p: any) => displayName(p)).join("・")}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {/* クリア確認モーダル（自前実装） */}
          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)} />
              <div className={`relative z-10 w-[92%] max-w-sm rounded-xl ${outdoorMode ? 'bg-white' : 'bg-neutral-500'} text-gray-900 p-4 shadow-xl border border-neutral-300`}>
                <h3 className="text-base font-semibold mb-2">今日の状態を消去</h3>
                <p className="text-sm text-gray-900 mb-4">
                  本当に今日の状態を消去して新規開始しますか？<br/>
                  ラウンド履歴・選択状態・離脱状態・重み設定が初期化されます。
                </p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" className="!bg-white !text-black !border !border-neutral-400 hover:!bg-neutral-100 font-semibold" onClick={() => setConfirmOpen(false)}>キャンセル</Button>
                  <Button type="button" className="!bg-red-600 !text-white hover:!bg-red-700 font-semibold" onClick={doClearToday}>消去する</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
