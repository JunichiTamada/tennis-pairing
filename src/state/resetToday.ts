import { Participant } from "@/types/participant";

const state = { participants: [] as Participant[] }; // 例
const pushSnapshot = () => {};

export function clearToday() {
  state.participants = state.participants.filter(p => !p.temporary);
  pushSnapshot();
}
