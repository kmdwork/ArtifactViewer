# Artifact Viewer

CodexやAIエージェントが生成したHTML成果物を、ローカルで一覧・検索・表示するためのデスクトップアプリを作成する。

## 目的

チャット内だけでレビュー結果や調査結果を確認するのではなく、HTML成果物として保存し、後から検索・閲覧できるようにする。

主な用途は以下。

* Code Review
* Architecture
* Study
* Research
* Automated Test Results

HTMLの生成自体は別Skillに任せる。

使用予定:

https://github.com/mathbullet/skills

このリポジトリの `html` Skillを利用してHTMLを生成する。

Artifact ViewerはHTMLを生成せず、保存されたHTMLの管理・検索・表示のみを担当する。

---

# 技術スタック

できるだけシンプルにする。

## 採用

* Tauri 2
* Vite
* Vanilla TypeScript
* HTML
* CSS
* Tauri File System Plugin

## MVPでは使わない

* React
* Next.js
* SQLite
* Node.jsのlocalhostサーバー
* バックエンドAPI
* AI機能

UIの規模が小さいため、Reactは使用しない。

Tauriを使うことでWeb技術でUIを実装しつつ、最終的にはmacOSなどで通常のデスクトップアプリとしてクリック起動できるようにする。

---

# Artifact保存場所

デフォルトでは以下を利用する。

```text
~/ai-artifacts/
```

例:

```text
~/ai-artifacts/
├── 20260908-agentcore-memory-review.html
├── 20260908-runtime-architecture.html
├── 20260909-kmdblog-review.html
└── 20260910-agentcore-study.html
```

物理ディレクトリ構造には分類を依存させない。

Project、Type、Tagなどの分類はHTML内部のmetadataを利用する。

将来的には保存ディレクトリを設定画面から変更できるようにしてもよいが、MVPでは固定でもよい。

---

# Metadata仕様

HTML内に2種類のmetadataを持たせる。

## metaタグ

一覧表示や検索で頻繁に使う軽量情報。

```html
<meta name="artifact:title" content="Runtime Memory Migration Review">
<meta name="artifact:type" content="review">
<meta name="artifact:project" content="AgentCore">
<meta name="artifact:created-at" content="2026-09-08T17:30:00+09:00">
```

最低限、以下を想定する。

```text
artifact:title
artifact:type
artifact:project
artifact:created-at
```

Typeの例:

```text
review
architecture
study
research
```

---

# Structured Metadata

Git情報やタグなど、構造を持つ情報はJSONで保存する。

```html
<script type="application/json" id="artifact-metadata">
{
  "version": 1,
  "tags": [
    "memory",
    "runtime",
    "agentcore"
  ],
  "risk": "medium",
  "git": {
    "repository": "custom-agentcore",
    "branch": "feature/memory",
    "commit": "a1b2c3d4",
    "baseCommit": "9f8e7d6c"
  }
}
</script>
```

将来的には以下も追加可能。

```text
changedFiles
additions
deletions
reviewStatus
testStatus
githubUrl
```

ただし、MVPでは必要最小限にする。

---

# TypeScript内部モデル

例えば以下程度でよい。

```ts
type Artifact = {
  path: string

  title: string
  type: string
  project: string
  createdAt: string

  tags: string[]
  risk?: string

  git?: {
    repository?: string
    branch?: string
    commit?: string
    baseCommit?: string
  }
}
```

---

# 基本処理

起動時に以下を行う。

```text
~/ai-artifacts
      ↓
HTMLファイルを再帰検索
      ↓
HTMLをテキストとして読む
      ↓
DOMParser
      ↓
<meta>を取得
      ↓
artifact-metadata JSONを取得
      ↓
Artifactオブジェクトへ変換
      ↓
Artifact[]としてメモリ保持
      ↓
一覧画面へ表示
```

DBは使用しない。

MVPではArtifact数がそれほど多くないことを想定し、起動時に全HTMLを読み込んでインメモリで検索する。

Artifact数が数千〜数万件になり、性能問題が出た時点でSQLiteやFTS導入を検討する。

---

# ファイル監視

`~/ai-artifacts/` を監視する。

以下が発生した場合、Artifact一覧を更新する。

* HTML追加
* HTML更新
* HTML削除

想定フロー:

```text
Codex
  ↓
HTML生成
  ↓
~/ai-artifacts/
  ↓
Tauri File Watcher
  ↓
Artifact一覧更新
```

Viewerを再起動しなくても新しいArtifactが表示されることを目標とする。

---

# UI

シンプルな2ペインまたは3ペイン構成にする。

例:

```text
┌──────────────────────────────────────────────────────────────┐
│ Artifact Viewer                     Search [              ]  │
├──────────────────────┬───────────────────────────────────────┤
│ Filters / Artifacts  │                                       │
│                      │                                       │
│ All                  │                                       │
│ Review               │                                       │
│ Architecture         │          HTML Preview                 │
│ Study                │                                       │
│ Research             │                                       │
│                      │                                       │
│ AgentCore            │                                       │
│ kmdblog              │                                       │
│                      │                                       │
│ artifact list...     │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

MVPでは見た目を作り込みすぎない。

---

# 必須UI機能

## Artifact一覧

以下を表示する。

```text
Title
Project
Type
Created At
```

可能であれば補助情報として以下も表示する。

```text
Risk
Git Commit
Tags
```

---

# 検索

MVPでは単純な部分一致検索でよい。

対象:

```text
title
project
type
tags
git.repository
git.branch
git.commit
```

インメモリの `Array.filter()` ベースで実装する。

---

# Filter

最低限以下を用意する。

```text
All
Review
Architecture
Study
Research
```

またProjectでも絞り込めるようにする。

Project一覧はArtifact metadataから動的に生成する。

---

# HTML Preview

Artifactを選択すると右側にHTMLを表示する。

HTMLをViewer本体のDOMへ直接 `innerHTML` で挿入しない。

Artifact HTMLには以下が含まれる可能性がある。

* CSS
* JavaScript
* MathJax
* Highlight.js
* 外部フォント
* SVG

そのためViewer UIとは分離されたiframe等で表示する。

Artifact側のJavaScriptからTauri APIへアクセスできないよう、可能な限りsandboxする。

Viewerの権限とArtifact HTMLの実行環境を分離する。

---

# HTML生成側との責務分離

構成は以下とする。

```text
Codex
  ↓
Artifact用Skill
  ↓
mathbullet html Skill
  ↓
HTML生成
  ↓
~/ai-artifacts/
  ↓
Artifact Viewer
```

Artifact ViewerはHTML生成には関与しない。

---

# Artifact用Skillについて

将来的に自分用の上位Skillを作成する。

例えば:

```text
artifact-report
```

このSkillから `mathbullet/skills` の `html` Skillを利用する。

Artifact用Skillでは以下のみを定義する。

* 保存場所
* metadata仕様
* Git metadata仕様
* Review文書の構成
* Artifact Type
* Naming rule

---

# Review HTMLの基本構成

レビュー用途では以下を標準とする。

```text
Goal

Summary

Changed Files

Architecture

Before / After

Automated Checks

Review Findings

Risks

Human Review Points

Open Questions

Git Information
```

Review Findingsは重要度ごとに分類してよい。

```text
Critical
Warning
Info
```

---

# ファイル名

HTML Skillの既存仕様に合わせる。

```text
{yyyymmdd}-{内容を表すケバブケース}.html
```

例:

```text
20260908-agentcore-memory-review.html
```

---

# ディレクトリ構成案

```text
artifact-viewer/
├── src/
│   ├── main.ts
│   ├── scanner.ts
│   ├── metadata.ts
│   ├── search.ts
│   ├── viewer.ts
│   └── style.css
│
├── src-tauri/
│   ├── capabilities/
│   ├── Cargo.toml
│   ├── src/
│   └── tauri.conf.json
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

ファイルは必要に応じて整理してよいが、過剰に細分化しない。

---

# MVP要件

以下が完成条件。

1. Tauriアプリとして起動できる
2. `~/ai-artifacts/` を読み取れる
3. HTMLを再帰検索できる
4. metaタグを解析できる
5. JSON metadataを解析できる
6. Artifact一覧を表示できる
7. Artifactを選択してHTMLを表示できる
8. Title検索ができる
9. Typeで絞り込める
10. Projectで絞り込める
11. Tag検索ができる
12. ファイル変更を検知して自動更新できる
13. Artifact HTMLをViewer本体から隔離して表示する
14. macOSアプリとしてビルドできる

---

# MVPでは実装しないもの

以下は後回し。

```text
SQLite
全文検索エンジン
AI検索
Embedding
RAG
Cloud同期
ユーザー認証
GitHub API連携
Artifact編集
HTML生成
PDF管理
Markdown Viewer
複雑な設定画面
```

必要になった段階で追加する。

---

# 設計方針

このアプリでは「シンプルさ」を優先する。

特に以下を避ける。

* 不要な抽象化
* 過剰なレイヤー分割
* Repository Patternなどの過剰設計
* 状態管理ライブラリ
* 不要な依存パッケージ
* MVP段階でのDB導入

基本的には、

```text
filesystem
→ parse
→ Artifact[]
→ filter
→ render
```

という単純な構造を維持する。

将来的な拡張性よりも、まず理解しやすく壊れにくい実装を優先する。

---

# 最終イメージ

Artifact Viewerは、

「AIが作った成果物をチャットから切り離して保存・閲覧するローカル基盤」

として扱う。

チャットは作業場所。

HTML Artifactは成果物。

Artifact Viewerは成果物の閲覧・検索場所。

という責務分離を目指す。
