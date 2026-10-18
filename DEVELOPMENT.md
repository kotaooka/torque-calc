# 開発者向け情報（torque-calc）

利用者向けの説明は [README.md](README.md) にあります。

## ファイル構成

```
index.html             画面（スタイルを含む）。解説は docs/explanation.md から埋め込む
js/torque.js           計算（ねじ・座面・ボルト穴の表、強度区分、摩擦係数の区分、VDI 2230 の許容締付け軸力と締付けトルク）。Node でも読み込み可
js/app.js              画面処理（トルクと軸力の図、トルクの内訳、結果とトルク表、テーマ、入力の保存、Service Worker の登録）
sw.js                  オフライン用のキャッシュ処理（Service Worker）
manifest.webmanifest   アプリとして追加するための設定
og.png                 SNS 共有用の画像（tools/screenshots.py で作る）
icons/                 アプリアイコン（tools/make_icons.py で作る）
docs/explanation.md    「解説」タブの原稿
docs/screenshots/      README 用のスクリーンショット（tools/screenshots.py で撮る）
tools/build.py         解説を index.html に埋め込む
tests/test.js          検算テスト
.github/workflows/     push 時の自動テスト
```

## 更新して公開するとき

- `index.html`・`js/`・`icons/` を変更したら、**`sw.js` 先頭の `VERSION` を必ず上げてから** push してください。上げないと、すでに使っている人の端末に古いファイルが残り続けます
- 画面の見た目を変えたときは、`docs/screenshots/` の画像と `og.png` も撮り直してください（撮影手順は `tools/screenshots.py` の先頭）
- 解説を直すときは `docs/explanation.md` を編集し、`python tools/build.py`（`pip install markdown`）で index.html に埋め込んでください。埋め込み忘れは CI で検出します
- GitHub Pages は main ブランチのルートを公開しています

## テスト

```
node tests/test.js    # 不一致があれば終了コード 1
```

## 実装のメモ

- **単位**：内部は長さ mm、力 N、トルク N·mm、応力 MPa。画面では kN・N·m で表示します
- **ねじの寸法**：d2 = d − 0.649519 P、d3 = d − 1.226869 P（ISO 724）から計算し、応力断面積 As = π/4 ×（(d2 + d3) ÷ 2）²。表を持たないのは、ISO 898-1 の As がこの式の値を丸めたものだからです
- **座面の径**：六角ボルトは ISO 4014・4017 の dw の最小（M24 以下は部品等級 A、M27 以上は B）。細目も同じ呼び径の並目の頭部を使います（ISO 8765）。メーカーのトルク表（ISO 4014・ISO 4762 共通の表）はこの値で再現できます
- **ボルト穴**：ISO 273 の fine・medium・coarse を JIS B 1001 の 1〜3 級として持ちます。表との照合は 2 級（medium）です
- **推奨トルク**：摩擦係数の最小で FMzul と MA を出します（VDI 2230 の表と同じ）。μG = μK として扱います
- **トルクの範囲**：`target` は MA × (1 ± ばらつき)、`upper` は MA ÷ (1 + ばらつき) を狙い値にして上限を MA に合わせます。軸力の最大はトルクの上限・摩擦の最小、最小はトルクの下限・摩擦の最大
- **注意の出し方**：利用率が ν を超えて 100% 以下なら案内（`infos`）、100% を超えたら注意（`warns`）
- **強度区分の径の上限**：9.8 は 16 mm 以下、ステンレスの -70・-80 は 24 mm 以下、-50 は 39 mm 以下（`dMax`）。超えると注意を出し、トルク表では灰色にします
- **表示の単位**：`st.unit`（`Nm`・`kgfcm`・`kgfm`）。内部の値に `UNITS` の係数を掛けて表示するだけで、計算は SI のまま
- **スマホ用の要約**：`#cSum`。760 px 以下だけ表示し、ねじと強度区分の直下に推奨トルクと軸力の範囲を出します
- **入力の保存**：localStorage のキー `torque-calc-inputs`。読み書きはすべて try/catch で囲み、保存できない環境でも動きます
- **テーマ**：QC Workbench の全ツールで共通のキー `qc-workbench-theme`
