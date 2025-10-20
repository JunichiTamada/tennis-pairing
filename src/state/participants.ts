import { Participant } from "@/types/participant";

// あなたの全体stateの取り出し方法に合わせて置換してください
const state = { participants: [] as Participant[] }; // 例
const pushSnapshot = () => {/* useHistoryStack.ts 経由で呼ぶ想定 */};

export function addGuest(name: string) {
  const id = crypto.randomUUID();
  state.participants.push({ id, name: name.trim(), temporary: true, active: true });
  pushSnapshot();
}

export function removeParticipant(id: string) {
  state.participants = state.participants.filter(p => p.id !== id);
  pushSnapshot();
}

export function toggleActive(id: string) {
  const p = state.participants.find(x => x.id === id);
  if (!p) return;
  p.active = !(p.active !== false); // undefined→true扱い
  pushSnapshot();
}

// 生成候補の統一フィルタ（どこからでも使えるように）
export function availableCandidates(list: Participant[]) {
  return list.filter(p => p.active !== false);
}
