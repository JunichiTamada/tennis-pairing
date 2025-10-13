#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-JunichiTamada/tennis-pairing}"
MILESTONE_TITLE="${MILESTONE_TITLE:-v2.0.0}"
ECHO_ONLY="${ECHO_ONLY:-0}"       # 1 = ドライラン（実行せず表示）
DEBUG="${DEBUG:-0}"               # 1 = set -x で詳細ログ

[ "$DEBUG" = "1" ] && set -x

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "❌ gh に未ログインです。'gh auth login' を実行してください。"
  exit 1
fi

gh repo set-default "$REPO" >/dev/null
echo "📦 Target repo: $REPO"

# --- ラベル作成/同期（存在すれば --force で正規化） ---
ensure_label () {
  local name="$1" color="$2" desc="$3"
  if gh api "repos/$REPO/labels" --paginate -q '.[] | select(.name=="'"$name"'") | .name' | grep -Fxq "$name"; then
    echo "✅ Label exists: $name (force sync)"
    CMD=(gh label create "$name" -c "$color" -d "$desc" --force)
  else
    echo "➕ Create label: $name"
    CMD=(gh label create "$name" -c "$color" -d "$desc")
  fi
  if [ "$ECHO_ONLY" = "1" ]; then echo "${CMD[@]}"; else "${CMD[@]}" >/dev/null; fi
}

ensure_label v2                "#0ea5e9" "v2 work"
ensure_label enhancement       "#a2eeef" "feature work"
ensure_label frontend          "#1f883d" "UI/front-end"
ensure_label algo              "#8250df" "algorithm"
ensure_label ui                "#d876e3" "user interface"
ensure_label good-first-review "#e99695" "good for review"

echo "🏁 Milestone (by title): $MILESTONE_TITLE"

create_issue () {
  local title="$1"; shift
  local body="$1"; shift
  local labels_csv="$1"; shift

  echo "📝 Creating: $title"
  if [ "$ECHO_ONLY" = "1" ]; then
    echo "gh issue create --title \"$title\" --body <<'EOF' --label $labels_csv --milestone \"$MILESTONE_TITLE\""
    echo "$body"
    echo "EOF"
  else
    # here-doc を --body に渡す（ghのバージョン差異を回避）
    gh issue create \
      --title "$title" \
      --body "$body" \
      --label "$labels_csv" \
      --milestone "$MILESTONE_TITLE"
  fi
}

# ===== 本文 =====
BODY_001=$'**概要**\n- データ構造を `RoundV2 { matches: Match[]; rest: Person[] }` へ移行。\n- 保存キーを `tdoubles_state_v2` に。v1 → v2 マイグレーション実装。\n\n**受け入れ基準**\n- [ ] v1保存 → 起動時にv2へ読み替え\n- [ ] v2保存で正常表示\n- [ ] 1面時の既存動作は不変\n\n**タスク**\n- 型定義/統計対応/キー切替/移行関数+テスト'
BODY_002=$'**概要**\n- N人/C面で `K=max(0,N-4C)` を休憩。ビームサーチ **B=24**。\n- 直前休み連続回避 + 累積休憩平準化。\n\n**受け入れ基準**\n- [ ] 直前休み連続が減る\n- [ ] 体感速度OK\n- [ ] 同点は当日シードで再現\n\n**タスク**\n- selectRestSet 実装/スコア/ログ'
BODY_003=$'**概要**\n- 4C人→2Cペア。コスト= wPartner + wPrevPair。貪欲→2ペア入替。\n\n**受け入れ基準**\n- [ ] 同一ペアの再現抑制\n- [ ] 直前近似の連続抑制\n\n**タスク**\n- makePairs/改善ループ'
BODY_004=$'**概要**\n- 2Cペア→C試合。対戦コスト= wOpp + wPrevOpp。反転禁止適用。\n\n**受け入れ基準**\n- [ ] 反転禁止常時成立\n- [ ] 対戦の連続偏り小\n\n**タスク**\n- assignMatches/合計スコア'
BODY_005=$'**概要**\n- generateDraft() を導入し案返却に統一（UIは即確定でもOK）。\n\n**受け入れ基準**\n- [ ] 案→確定が一貫\n- [ ] ログ/自己テスト安定\n\n**タスク**\n- generateDraft/confirmDraft 分離'
BODY_006=$'**概要**\n- 直前ラウンドのUndo。rounds.pop() + フラグ復元 + スクロール戻し。\n\n**受け入れ基準**\n- [ ] 視覚/論理状態が完全に戻る\n\n**タスク**\n- スナップショット/モーダル'
BODY_007=$'**概要**\n- 固定ペア（ロック）を強制配置。矛盾は警告。\n\n**受け入れ基準**\n- [ ] 常に固定維持（不足時はエラー）\n- [ ] 追加/解除が即反映\n\n**タスク**\n- 設定UI/コスト強制'
BODY_008=$'**概要**\n- 一時メンバー（当日のみ）/初期登録編集（永続化）。\n\n**受け入れ基準**\n- [ ] 一時は消去/翌日で消滅\n- [ ] 本登録編集は次回起動も反映\n\n**タスク**\n- モーダル/保存バージョン'
BODY_009=$'**概要**\n- 3面UIを有効化し性能/公平性を検証。\n\n**受け入れ基準**\n- [ ] 12人未満はアラート\n- [ ] 実機で高速\n- [ ] 偏り小\n\n**タスク**\n- courtNames[3]/統合テスト'
BODY_010=$'**概要**\n- ヘルプ/READMEをv2仕様に更新。\n\n**受け入れ基準**\n- [ ] 操作だけで意図が伝わる\n- [ ] v1/v2の差分が明確\n\n**タスク**\n- ヘルプ/README更新'

# ===== 起票 =====
create_issue "v2-001: データモデル/ストレージを v2 化（マイグレーション含む）" "$BODY_001" "v2,enhancement,frontend"
create_issue "v2-002: 休憩者選定（ビーム幅B=24）"                                 "$BODY_002" "v2,enhancement,algo"
create_issue "v2-003: ペア化（貪欲 + 2ペア入替）"                                   "$BODY_003" "v2,enhancement,algo"
create_issue "v2-004: 試合化（完全列挙・反転禁止込み）"                             "$BODY_004" "v2,enhancement,algo"
create_issue "v2-005: 下書きAPI導入（内部は案返却で統一）"                           "$BODY_005" "v2,enhancement,frontend,algo"
create_issue "v2-006: Undo（直前ラウンド取り消し）"                                 "$BODY_006" "v2,enhancement,frontend,ui"
create_issue "v2-007: 固定ペア（ロック）"                                           "$BODY_007" "v2,enhancement,frontend,ui,algo"
create_issue "v2-008: 一時メンバー / 初期登録編集"                                  "$BODY_008" "v2,enhancement,frontend,ui"
create_issue "v2-009: 3面フラグON + 性能検証"                                       "$BODY_009" "v2,enhancement,algo,frontend"
create_issue "v2-010: ドキュメント更新（ヘルプ/README）"                             "$BODY_010" "v2,enhancement,frontend,ui"

echo "✅ Done. Issues created."

