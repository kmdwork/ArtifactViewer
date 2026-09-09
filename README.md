# Artifact Viewer

`~/ai-artifacts/`に保存したHTML成果物を一覧・検索・プレビューするTauri 2アプリです。

## 開発

```sh
npm install
npm run tauri dev
```

## macOSアプリのビルド

```sh
npm run tauri build -- --bundles app
```

生成物は`src-tauri/target/release/bundle/macos/Artifact Viewer.app`です。

## Artifact metadata

```html
<meta name="artifact:title" content="Runtime Memory Migration Review">
<meta name="artifact:type" content="review">
<meta name="artifact:project" content="AgentCore">
<meta name="artifact:created-at" content="2026-09-08T17:30:00+09:00">
<script type="application/json" id="artifact-metadata">
{
  "version": 1,
  "tags": ["memory", "runtime"],
  "risk": "medium",
  "git": { "repository": "custom-agentcore", "branch": "feature/memory", "commit": "a1b2c3d4" }
}
</script>
```

プレビューは`sandbox="allow-scripts"`を付けたiframeで表示します。同一オリジン、親画面の操作、ポップアップ、フォーム送信、ダウンロードは許可しません。
