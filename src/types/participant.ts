export type Participant = {
  id: string;
  name: string;
  temporary?: true;   // GUESTならtrue
  active?: boolean;   // 一時離脱/復帰（undefinedはtrue相当）
};
