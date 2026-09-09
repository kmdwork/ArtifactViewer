# Issue #2 実装計画: Preview上部のArtifactメタ情報表示

## Goal

選択中のArtifactが属するProject、Type、および利用可能なGit branch / commitをHTML Preview上部で即座に確認できるようにする。

この計画はIssue #2の実装前レビュー用であり、このPRではアプリケーションコードを変更しない。

Related to #2

## 要求の整理

- Preview領域上部に、選択中Artifactのメタ情報を表示する。
- ProjectとTypeはArtifact選択時に常に表示する。
- Git branchとGit commitは、それぞれmetadataに値が存在する場合だけ表示する。
- 選択中Artifactが変わった場合、同じタイミングで表示内容を更新する。
- Artifact未選択時はメタ情報バーを非表示にし、既存の空状態を表示する。
- 既存のArtifactオブジェクトだけを利用し、新しいデータ取得処理を追加しない。
- iframeによるHTML Preview、`sandbox="allow-scripts"`、`srcdoc`設定は変更しない。

## Repository analysis

現在の実装では、責務と更新経路は次のようになっている。

- `src/model.ts`
  - `Artifact.project`と`Artifact.type`は必須の文字列。
  - `Artifact.git.branch`と`Artifact.git.commit`は任意。
- `src/metadata.ts`
  - 欠損Projectは`Uncategorized`、欠損Typeは`unknown`へ正規化される。
  - Git metadataは空白を除去した値だけがArtifactへ格納される。
- `src/main.ts`
  - Preview領域のDOMを定義する。
  - `selectArtifact()`が一覧クリック、検索・フィルター、再スキャン後の選択状態を集約している。
  - 選択解除時は既存の`preview-empty`を表示する。
- `src/viewer.ts`
  - iframeの`srcdoc`、title、表示状態だけを更新する。
- `src/style.css`
  - `.preview-panel`とiframeがPreview領域全体を使用する現在のレイアウトを定義する。
- 自動テスト基盤はなく、既存の検証コマンドは`npm run check`と`npm run build`。

このため、メタ情報表示は`selectArtifact()`の既存更新経路へ接続し、iframe制御の責務は変更しない構成が最小となる。

## Scope

### In scope

- Preview上部のメタ情報バーのDOM追加
- Project / Type / Git branch / Git commitの表示
- Artifact選択、選択切り替え、選択解除に伴う表示更新
- 値の長さやPreview領域幅に耐える最小限のレイアウト調整
- metadata文字列をHTMLとして解釈しない安全な描画
- TypeScriptチェック、Webビルド、Tauriアプリ上での手動確認

### Out of scope

- Artifactモデルまたはmetadata仕様の変更
- scanner、ファイル監視、検索・フィルター処理の変更
- 新しいデータ取得やGitHub API連携
- iframeの`sandbox`、`srcdoc`、referrer policyの変更
- Artifact HTMLへのメタ情報挿入
- Tauri capability、Rustコード、依存パッケージの変更
- メタ情報の編集、コピー操作、リンク化
- UI全体の再設計

## Assumptions and decisions

- Artifact未選択時はメタ情報バー全体を非表示にし、既存の空状態だけを表示する。
- ProjectとTypeは正規化済みの`Artifact`値をそのまま表示する。欠損元データでは`Uncategorized` / `unknown`となる。
- branchとcommitは独立して判定し、一方だけ存在するArtifactでも存在する項目を表示する。
- commitはArtifact一覧と整合させて先頭8文字を表示する。完全な値はtitle属性などで確認可能にする。
- metadataはローカルHTML由来の信頼できない文字列として扱い、`textContent`または既存のescape処理を使って描画する。
- 新しいコンポーネントライブラリやテスト依存は追加しない。

## Plan

- [ ] Phase 1: Previewメタ情報バーの表示構造とレイアウト
- [ ] Phase 2: Artifact選択状態とのデータ連携
- [ ] Phase 3: セキュリティ・回帰・受け入れ確認

## Phase 1: Previewメタ情報バーの表示構造とレイアウト

### Tasks

- `src/main.ts`のPreview領域に、iframeの外側かつ上部に配置されるメタ情報コンテナを追加する。
- Project、Type、Git branch、Git commitをラベルと値の組で表せる意味の明確なDOM構造を用意する。
- `src/style.css`でPreview領域を「メタ情報バー + 残りを占有するPreview」の縦配置にする。
- 長いProject名やbranch名がPreview幅を圧迫しても、横スクロールや省略表示などで全体レイアウトを壊さないようにする。
- 未選択時の初期状態ではコンテナを非表示にする。

### Acceptance Criteria

- メタ情報バーがViewer本体のDOMにあり、Artifact iframeのDOM内部へ挿入されていない。
- メタ情報バーはPreviewの上部に固定され、iframeが残りの利用可能領域を占有する。
- メタ情報バーを非表示にした状態では、既存の未選択表示がPreview領域内で正しく中央表示される。
- 狭いPreview幅や長い値でも、サイドバー・Artifact一覧・Previewの3ペイン構成が崩れない。
- iframeの`sandbox`、`referrerpolicy`、title、`srcdoc`制御に変更がない。

## Phase 2: Artifact選択状態とのデータ連携

### Tasks

- メタ情報コンテナの各値要素を`src/main.ts`で参照する。
- `selectArtifact()`の既存経路内で、Preview更新と同時にメタ情報を更新する。
- ProjectとTypeを常に表示し、branch / commitは値の有無に応じて各項目を個別に表示・非表示にする。
- commitを8文字へ短縮表示し、必要に応じて完全な値を非実行属性で参照可能にする。
- Artifact未選択時は以前のArtifact情報を消去し、メタ情報バーを非表示にする。
- 描画には`textContent`などを使用し、metadataに含まれるHTMLを実行・解釈しない。

### Acceptance Criteria

- Artifactを選択すると、そのArtifactのProjectとTypeがPreview上部に表示される。
- branchとcommitが両方ある場合は両方が表示され、commit表示は先頭8文字になる。
- branchだけ、commitだけ、Git情報なしの各ケースで、存在しない項目だけが非表示になり余分な空白や区切りが残らない。
- 別Artifactを選択すると、全項目が新しいArtifactの値へ切り替わり、前の値が残らない。
- 検索、Type / Projectフィルター、手動Refresh、ファイル監視による再スキャンで選択対象が変わった場合も、表示が現在の選択と一致する。
- 結果が0件になった場合はメタ情報バーが非表示になり、既存の空状態が表示される。
- `<script>`やHTML属性を含むmetadata値を表示してもDOMとして実行されない。
- 新しいファイル読み取り、Git問い合わせ、ネットワークアクセスは発生しない。

## Phase 3: セキュリティ・回帰・受け入れ確認

### Tasks

- TypeScript型チェックとViteビルドを実行する。
- Git情報あり・一部あり・なし、および長い値を持つサンプルArtifactで手動確認する。
- 選択切り替え、検索・フィルターによる選択変更、0件状態、Refresh後の再選択を確認する。
- Preview内JavaScriptを含むArtifactで既存iframe表示が維持されることを確認する。
- 変更差分が想定ファイルだけであり、Tauri権限やArtifact解析処理を変更していないことを確認する。

### Acceptance Criteria

- `npm run check`が成功する。
- `npm run build`が成功する。
- Issue #2の4つの完了条件をmacOS上のTauriアプリで再現確認できる。
- Artifact HTMLの表示とJavaScript動作が従来どおりiframe内に限定される。
- iframeのsandbox属性が`allow-scripts`のままで、Tauri APIへ到達可能な権限を追加していない。
- 既存の一覧選択、検索、Type / Projectフィルター、Refresh、未選択表示に回帰がない。
- 実装差分が原則として`src/main.ts`と`src/style.css`に限定され、追加依存がない。

## Implementation order and dependencies

```text
Phase 1: DOM構造・レイアウト
    ↓
Phase 2: 選択状態・metadata描画
    ↓
Phase 3: 自動チェック・手動受け入れ確認
```

- Phase 2はPhase 1で追加するDOM要素を更新するため、Phase 1に依存する。
- Phase 3は完成した表示と状態遷移を検証するため、Phase 1とPhase 2に依存する。
- 各Phaseは独立したコミットまたはレビュー単位にし、Phase 1では構造・CSS、Phase 2では状態連携、Phase 3では検証結果を確認できるようにする。

## Expected implementation files

- `src/main.ts`
- `src/style.css`

`src/viewer.ts`は既存iframe制御を維持するため、原則として変更しない。実装時にPreview表示責務を移す必要が判明した場合は、変更理由をPhase 2のレビューで明示する。

## Risks and mitigations

### Preview高の圧迫

メタ情報バーの追加でiframeの縦領域が減る。Preview領域をflex columnにし、iframe側へ`min-height: 0`と残領域の伸縮を明示して防ぐ。

### 長いmetadataによるレイアウト崩れ

branchやProject名が長い可能性がある。値要素の最大幅、省略表示、横方向の折り返し方針を定義し、狭幅と長い値の組み合わせで確認する。

### 欠損Git項目の空白

`git`オブジェクト自体ではなく、branch / commitを個別に判定して項目単位で非表示にする。

### metadata由来のDOM injection

metadata文字列を`innerHTML`へ直接渡さず、安全なテキストAPIまたはescape処理を使用する。

### 選択状態との不整合

表示更新を一覧クリック専用処理へ追加せず、検索・フィルター・Refreshも通る`selectArtifact()`へ集約する。

### sandbox回帰

メタ情報バーはiframeの兄弟要素として実装し、`setPreview()`とiframe属性を変更対象外にする。最終差分で明示的に確認する。

## Current Phase

Planning complete. Implementation has not started.

Next: Phase 1 — Previewメタ情報バーの表示構造とレイアウト。
