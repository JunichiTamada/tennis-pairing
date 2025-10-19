import { useEffect, useRef, useState } from "react";

/**
 * 変更前スナップショットを積むための、超シンプルな Undo スタック。
 * - メモリ + localStorage のハイブリッド（ページ再読み込みでも残る）
 * - push/pop 時に描画が更新される（version を更新）
 */
export function useHistoryStack<T>(key: string, max = 50) {
  const stackRef = useRef<T[]>([]);
  const initedRef = useRef(false);
  const [version, setVersion] = useState(0); // UI更新用

  // 初回：localStorage から復元
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) stackRef.current = arr;
      }
    } catch {
      // 失敗しても無視
    }
    // 読み込んだことを UI に反映
    setVersion((v) => v + 1);
  }, [key]);

  const persist = () => {
    try {
      localStorage.setItem(key, JSON.stringify(stackRef.current));
    } catch {
      // 失敗しても致命的ではないので無視
    }
  };

  const push = (snap: T) => {
    stackRef.current.push(snap);
    if (stackRef.current.length > max) stackRef.current.shift();
    persist();
    setVersion((v) => v + 1); // UI 更新
  };

  const pop = (): T | null => {
    if (stackRef.current.length === 0) return null;
    const val = stackRef.current.pop() ?? null;
    persist();
    setVersion((v) => v + 1); // UI 更新
    return val;
  };

  const clear = () => {
    stackRef.current = [];
    persist();
    setVersion((v) => v + 1); // UI 更新
  };

  return {
    history: stackRef.current,      // 参照用
    canUndo: stackRef.current.length > 0,
    push,
    pop,
    clear,
    _v: version, // 外からは使わなくてOK（強制再描画トリガ）
  };
}
