## 概要

LINE BotのグループID、ルームID、ユーザーIDを取得するためのGoogle Apps Scriptツールです。
Webhook経由でLINEからのイベントを受信し、スプレッドシートにIDを記録します。

## スプシURL
https://docs.google.com/spreadsheets/d/1gFiWcdETYph1SWNDriH8CsRmcc9JJTT1JdUVzzSyP7Q/edit?gid=1030954051#gid=1030954051

## 機能

- **Webhook受信**: LINEからのメッセージイベントを受信
- **ID自動抽出**: グループID、ルームID、ユーザーIDを自動識別
- **スプレッドシート記録**: 受信データとIDをWebhookLogシートに記録
- **グループ情報取得**: LINE APIを使用してグループ詳細情報を取得（オプション）

## アーキテクチャ

```
src/
├── index.ts              # GASエントリーポイント（doPost, getGroupInfo）
├── env.ts                # 環境変数定義
└── services/
    ├── sheetService.ts   # スプレッドシート操作
    ├── webhookService.ts # Webhookイベント処理
    └── lineService.ts    # LINE API呼び出し
```

## セットアップ

### GASへのデプロイ

```bash
# ビルド
pnpm build:LINE

# デプロイ
# 開発環境
pnpm build:dev:LINE
# 本番環境
pnpm build:prod:LINE

## 使い方

### 1. LINE Botの設定

1. LINE Developers ConsoleでWebhook URLを設定
   - ウェブアプリケーションとしてデプロイしたGASのURLを設定
2. グループまたはルームにBotを追加
3. 何かメッセージを送信

### 2. IDの取得

1. スプレッドシートの「WebhookLog」シートを確認
2. 「>>> コピーしてください: xxxxx <<<」の行からIDをコピー

### 3. グループ情報取得（オプション）

GASエディタから`getGroupInfo('グループID')`を実行すると、グループ名や画像URLなどの詳細情報を取得できます。

## 環境変数

- `LINE_BOT_TOKEN`: LINE Bot Channel Access Token（スクリプトプロパティに設定）

## トリガー設定

トリガー設定は不要です。WebhookによるHTTPリクエストで動作します。

## 環境
### 本番環境
- [Spreadsheets](https://docs.google.com/spreadsheets/d/1gFiWcdETYph1SWNDriH8CsRmcc9JJTT1JdUVzzSyP7Q/edit)
- Google Apps Script: デプロイ後のWebアプリURL

### 検証環境
- 本番環境と同一

## 検証方法

1. LINE Botをテストグループまたはルームに招待
2. メッセージを送信
3. スプレッドシートの「WebhookLog」シートにIDが記録されることを確認


## 開発
開発手順については、[こちら](/README.md)を参照
