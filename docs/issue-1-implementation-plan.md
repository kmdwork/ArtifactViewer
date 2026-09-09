# Issue #1 implementation plan

Related to #1

## Goal

Typeフィルターの固定値依存をなくし、読み込んだ `Artifact[]` の `type` metadataからフィルターを動的生成する。

## Confirmed decisions

- Artifactが存在するTypeだけを表示する
- metadataにTypeがないArtifactは、現在の正規化結果である `unknown` としてフィルターへ表示する
- 選択中Typeの最後のArtifactが削除された場合は、Type選択を `All` へ戻す
- 任意Typeの表示名は、現在のUIと同じく先頭文字だけを大文字化する
- TypeのソートはProjectフィルターと同じ `localeCompare()` を使う
- 現在のType別件数表示を維持する
- 新しい設定画面、Type定義ファイル、テスト用依存パッケージは追加しない

## Plan

- [ ] Phase 1: Type抽出ロジック
- [ ] Phase 2: Typeフィルターの動的描画
- [ ] Phase 3: ファイル監視更新時の状態整合性
- [ ] Phase 4: 受け入れ確認

## Phase 1: Type抽出ロジック

### Scope

- `src/search.ts` の `DEFAULT_TYPES` を削除する
- `Artifact[]` からTypeを抽出する純粋関数を追加する
- Typeを重複排除し、`localeCompare()` でソートする

### Completion criteria

- `DEFAULT_TYPES` とその参照が残っていない
- `review / architecture / test` など任意のTypeを重複なく返す
- 大文字・小文字の違いは既存のmetadata正規化により同一Typeとして扱われる
- `unknown` を含むArtifactがあればType一覧へ含まれる
- 入力の `Artifact[]` を変更しない
- DOMに依存しない

## Phase 2: Typeフィルターの動的描画

### Scope

- `src/main.ts` の `renderFilters()` でPhase 1の結果を使用する
- `All` を常に先頭へ表示する
- 動的TypeごとのArtifact件数を表示する
- 既存のType選択と絞り込みを維持する

### Completion criteria

- Artifactに存在するTypeだけが表示される
- `artifact:type="test"` のArtifactを追加すると、コード変更なしで `Test` が表示される
- 各Typeの件数が正しい
- Typeボタンの選択状態と絞り込みが正常に動作する
- Projectフィルターと検索機能に影響しない

## Phase 3: ファイル監視更新時の状態整合性

### Scope

- 再スキャン後、選択中Typeが新しいType一覧に存在するか検証する
- 存在しない場合だけType選択を `All` へ戻す
- 既存の検索文字列とProject選択は維持する

### Completion criteria

- 選択中Typeの最後のArtifactを削除すると `All` へ戻る
- 一覧、件数、プレビューが更新後の状態と一致する
- Artifact追加時や選択中Typeが残っている場合は選択状態を維持する
- ファイル監視と手動Refreshの両方で同じ挙動になる

## Phase 4: 受け入れ確認

### Scope

一時的なHTML Artifactを使い、追加・更新・削除を含む一連の操作を確認する。

### Completion criteria

- `review / architecture / study / research` のうち、Artifactが存在するTypeが表示される
- 新しい `test` Typeが自動表示される
- 同じTypeのArtifactが複数あってもフィルターボタンは1つ
- Type別件数が正しい
- Typeによる絞り込みが正しい
- Type変更とファイル削除が監視後に反映される
- 選択中Typeが消えた場合は `All` へ戻る
- `npm run check` が成功する
- `npm run build` が成功する
- `cargo check` が成功する
- 確認用Artifactを削除し、元の状態へ戻す

## Implementation order and dependencies

```text
Phase 1: Type抽出ロジック
    ↓
Phase 2: 動的フィルター描画
    ↓
Phase 3: 監視更新時の状態整合性
    ↓
Phase 4: 受け入れ確認
```

Phase 2はPhase 1の抽出関数に依存する。Phase 3は動的フィルター描画後の状態を扱うためPhase 2に依存する。Phase 4は全Phaseの完了後に実施する。

## Expected files

- `src/search.ts`
- `src/main.ts`

metadataモデル、scanner、Tauri権限、HTMLプレビューは変更しない。