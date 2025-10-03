# テニスダブルス・ペア決め Web アプリ（MVP）

GitHub Pages で公開している、**当日参加メンバーからダブルスの組み合わせを自動生成**するシングルページアプリ（SPA）です。

* 公開URL: [https://junichitamada.github.io/tennis-pairing/](https://junichitamada.github.io/tennis-pairing/)
* 推奨端末: **スマホ**（屋外での利用を想定）／PCブラウザでも可

> 当日の状態は端末の **localStorage** に自動保存され、翌日に自動リセットされます（「今日の状態を消去」で手動リセット可）。

---

## 特長

* **屋外モード**（高輝度）：黄色の強調色で屋外でも視認性を確保
* **屋内モード**（濃グレー基調）：コントラスト重視の配色
* **最新ラウンドが最上段**、3行レイアウト（上:ペアA／中:vs／下:ペアB）
* **長押し（スマホ）／右クリック（PC）で一時離脱**、タップで選択/解除
* **日付ベースの擬似シード**で“同点候補のランダム”を当日内で再現可能
* **反転禁止**（AB vs CD → BA vs DC はNG）や **連続休み回避** を考慮
* **同じ参加者でも初回の組み合わせはランダムに変化**（固定化を回避）

---

## 使い方（現場向けクイックガイド）

1. 参加者名をタップして**選択**（解除もタップ）。
2. **長押し（スマホ）／右クリック（PC）**で一時離脱／復帰。
3. 「**次のペアを決める**」を押す。
4. 最新ラウンドが一番上に表示。休憩者は「休憩: …」に表示。
5. やり直したいときは「**今日の状態を消去（新規開始）**」。

> ヒントは画面下に常時表示。自己テストは「自己テストを実行」。

---

## アルゴリズムの概要

当日履歴から以下を集計し、**スコアが最小**の組み合わせを採用します。

* **同一ペア回数**（重み *wPartner*）
* **個人×個人の対戦回数**（重み *wOpp*）
* **直前類似ペナルティ**（重み *wPrev*）
* **直前休みの連続回避**（固定ペナルティ）

**反転禁止**：同じ4人で AB vs CD の次に BA vs DC になる案は不採用。
**同点候補**が複数ある場合は、**当日シードの乱数**でランダムに1案を選択（当日内は再現可能）。

---

## 開発情報

* Framework: **Vite + React + TypeScript**
* UI: **Tailwind CSS v4**, **shadcn/ui**（Button, Card）
* デプロイ: **GitHub Pages**（Actions による自動ビルド & デプロイ）

### ローカル実行

```bash
# 依存関係の導入
npm i

# 開発サーバ（http://localhost:5173）
npm run dev

# 本番ビルド
npm run build

# ビルドのプレビュー（必要なら）
npm run preview
```

### デプロイ（GitHub Actions）

* `main` ブランチに push → 自動で **build & deploy** が走ります。
* ベースパスは `vite.config.ts` の `base: '/tennis-pairing/'` を使用。
* 反映が見えないときはキャッシュ回避で `?v=日時` を付けてアクセス。

### Tailwind の safelist

ビルド時に使用クラスのみが CSS に残るため、**動的に切り替える色クラス**は safelist 済み（`tailwind.config.js`）。

---

## 設定・仕様メモ

* **屋外/屋内モード**：文言は固定「屋外モード」。色で状態を表示（ON=黄色、OFF=白）。
* **参加者名表示**：「登録名 + さん」。コード内の名前は「さん」無しで保持。
* **一時離脱の動作**：

  * 選択中のみ長押し/右クリックが有効。
  * 復帰後、直近ラウンドの組み合わせ優先ロジックで反映。
* **重み設定**：「重みをデフォルトに戻す」で `wPartner=2, wOpp=1, wPrev=1` に戻る。
* **データ永続化**：`localStorage`（キー: `tdoubles_state_v1` / `tdoubles_prefs_v1`）。

---

## トラブルシュート

* **色が反映されない** → ブラウザキャッシュの影響。`?v=2025xxxx` を付けるか、ハードリロード。
* **スマホでボタン色が薄い** → OS/ブラウザの自動着色を抑止済（`appearance-none` / `!bg-…`）。それでも薄い場合は報告してください。
* **GitHub Pages が 404** → このリポジトリの **Settings → Pages** で公開設定を確認。

---

## 配布用オプション（任意）

* **短縮URL**（例：bit.ly で `https://bit.ly/tennis-pair` を取得）
* **QRコード**：`docs/qr.png` を置いて README に貼ると現場で配布が楽です。

---

## ライセンス

* 現在: **Private/非公開用途**。公開に切り替える場合は **MIT** などへ変更可。

---

## 変更履歴（抜粋）

* MVP: 屋外/屋内モード、最新上表示、反転禁止・連続休み回避、当日シード、自己テスト、ヘルプ、モーダル確認、配色調整。

---

# English README (MVP)

A single-page app (SPA) published on GitHub Pages that **automatically suggests doubles pairings** from the participants available **today**.

* Live URL: [https://junichitamada.github.io/tennis-pairing/](https://junichitamada.github.io/tennis-pairing/)
* Recommended device: **smartphone** (optimized for outdoor use); desktop browsers also supported

> The state of the day is automatically saved to the device's **localStorage** and **reset the next day**. You can also reset manually via **“Clear today’s state”**.

---

## Features

* **Outdoor mode** (high brightness): yellow accents for visibility under sunlight
* **Indoor mode** (dark gray theme): contrast-focused palette
* **Newest round at the top**, displayed in **three lines** (Top: Pair A / Middle: “vs” / Bottom: Pair B)
* **Long-press (mobile) / Right-click (desktop)** for temporary leave; tap to select/deselect
* **Date-based pseudo-random seed** to keep tie-breaking random choices reproducible within the same day
* **Flip prevention** (AB vs CD → BA vs DC is disallowed) and **avoid back-to-back rests**
* **Initial pairing varies randomly** even with the same participants (avoids fixed pattern)

---

## Quick Start (For Courtside Use)

1. Tap player names to **select** (tap again to deselect).
2. **Long-press (mobile) / Right-click (desktop)** to toggle temporary leave / return.
3. Press **“Decide next pairs”**.
4. The newest round appears at the top. Resting players are shown under **“Rest:”**.
5. To restart, press **“Clear today’s state (start fresh)”**.

> A short **hint** is always shown at the bottom. **Self-tests** can be run via the “Run self-tests” button.

---

## Algorithm Overview

We aggregate the day’s history and pick a combination with the **minimum score** considering:

* **Repeat partner counts** (*wPartner*)
* **Head-to-head opponent counts** (*wOpp*)
* **Similarity to the previous round** (*wPrev*)
* **Penalty for making the same people rest twice in a row**

**Flip prevention**: For the same four players, if one round was AB vs CD, BA vs DC is rejected in the next round.
When multiple candidates tie with the best score, we pick one **at random** using the **date-seeded RNG** (reproducible within the day).

---

## Development

* Framework: **Vite + React + TypeScript**
* UI: **Tailwind CSS v4**, **shadcn/ui** (Button, Card)
* Deploy: **GitHub Pages** (auto build & deploy via Actions)

### Run Locally

```bash
npm i                # install deps
npm run dev          # dev server (http://localhost:5173)
npm run build        # production build
npm run preview      # preview build
```

### Deployment (GitHub Actions)

* Pushing to the `main` branch triggers **build & deploy** automatically.
* The base path is set to `base: '/tennis-pairing/'` in `vite.config.ts`.
* If updates don’t show up, add a cache-busting query like `?v=2025xxxx`.

### Tailwind Safelist

Since Tailwind prunes unused classes at build time, **dynamically toggled color classes** are safelisted in `tailwind.config.js`.

---

## Notes & Behavior

* **Outdoor/Indoor mode**: The button label stays “Outdoor Mode”; color indicates state (ON = yellow, OFF = white).
* **Display names**: shows “{name}さん” in UI; raw names are stored without “さん”.
* **Temporary leave**:

  * Only works when the player is currently selected.
  * Upon return, the player is favored by the recent-round logic.
* **Weights**: “Reset weights to default” returns to `wPartner=2, wOpp=1, wPrev=1`.
* **Persistence**: `localStorage` keys `tdoubles_state_v1` / `tdoubles_prefs_v1`.

---

## Troubleshooting

* **Colors aren’t updating** → Browser cache. Try adding `?v=2025xxxx` or hard reload.
* **Buttons look too pale on mobile** → We disable OS coloring with `appearance-none` + strong `!bg/*` classes. If still an issue, please report your device/OS.
* **GitHub Pages returns 404** → Check **Settings → Pages** on this repo.

---

## Distribution Tips (Optional)

* **Short URL** (e.g., bit.ly) to share more easily.
* **QR code**: commit `docs/qr.png` and embed it in this README for courtside sharing.

---

## License

* Currently **Private**. Consider switching to **MIT** if you plan to open-source.

---

## Changelog (excerpt)

* MVP: outdoor/indoor modes, newest-first display, flip prevention & no double-rest, date-seeded randomness, self-tests, help text, confirmation modal, color tuning.
