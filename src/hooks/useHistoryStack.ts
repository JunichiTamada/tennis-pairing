// Undo/Redoの中核。Redoは今回は未使用だが拡張しやすい形に。
import { useEffect, useRef, useState } from "react";

export type Snapshot<T> = T;

export function useHistoryStack<T>(key: string) {
  const [history, setHistory] = useState<Snapshot<T>[]>([]);
  const redoRef = useRef<Snapshot<T>[]>([]); // 将来Redo用

  useEffect(() => {
    const raw = localStorage.getItem(`${key}:history`);
    if (raw) setHistory(JSON.parse(raw));
  }, [key]);

  function push(snap: Snapshot<T>) {
    setHistory(prev => {
      const next = [...prev, snap];
      localStorage.setItem(`${key}:history`, JSON.stringify(next));
      redoRef.current = []; // 新規操作でRedoはクリア
      return next;
    });
  }

  function pop() {
    let last: Snapshot<T> | undefined;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      last = prev[prev.length - 1];
      localStorage.setItem(`${key}:history`, JSON.stringify(next));
      return next;
    });
    return last;
  }

  return { history, push, pop };
}
