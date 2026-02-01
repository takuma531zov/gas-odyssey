## 概要
Instagram DMとSlackを双方向連携します。
- Instagram DM → Slack通知
- Slackスレッド返信 → Instagram DM送信

Instagram APIトークンの自動更新機能付き。

## 機能

### DM受信（Instagram → Slack）
1. Instagram Webhook受信（doGet: 検証、doPost: 処理）
2. DM内容解析（エコー・既読をスキップ）
3. Instagram Graph APIでユーザー情報取得
4. Slackへメッセージ送信
5. スプレッドシートへログ出力
6. エラー時LINE通知
7. Instagram APIトークン自動更新

### DM返信（Slack → Instagram）
1. Slack Event受信（Slack Events API + GAS doPost/router）
2. 重複イベント検出（GAS CacheService によるリトライ対策）
3. 親メッセージから送信者ID抽出（Slack Web API: conversations.replies + 内部パーサ）
4. Instagram Messages APIでDM送信（Instagram Graph API: Messages + GAS UrlFetchApp）
5. 成功時Slackメッセージにリアクション追加（Slack Web API: reactions.add）
6. スプレッドシートへ返信ログ出力（GAS SpreadsheetApp）
7. エラー時LINE通知（LINE Messaging API: push message）

## 環境変数（スクリプトプロパティ）

### 共通
| プロパティ | 説明 |
|-----------|------|
| `INSTAGRAM_VERIFY_TOKEN` | Instagram Webhook検証トークン |
| `INSTAGRAM_API_TOKEN` | Instagram Graph APIアクセストークン（自動更新） |
| `LINE_API_TOKEN` | LINE Messaging APIトークン |
| `LINE_BOT_ID` | LINE通知先ユーザーID |

### DM受信用
| プロパティ | 説明 |
|-----------|------|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |
| `LOG_SHEET_NAME` | ログ出力先シート名 |

### DM返信用
| プロパティ | 説明 |
|-----------|------|
| `SLACK_BOT_TOKEN` | Slack Web API認証用（Bot Token） |
| `SLACK_CHANNEL_ID` | 通知先チャンネルID |
| `INSTAGRAM_PAGE_ID` | Instagram Business Account ID |
| `REPLY_LOG_SHEET_NAME` | 返信ログシート名 |

## ログ形式

### DM受信ログ
| タイムスタンプ | 送信者ID | 送信者名 | ユーザー名 | メッセージ | ステータス | 詳細 |
|-------------|---------|---------|----------|-----------|----------|------|

### DM返信ログ
| タイムスタンプ | Instagram送信先ID | 返信内容 | ステータス | 詳細 |
|-------------|------------------|---------|----------|------|

## 外部設定

### Slack App設定
1. Bot Token Scopes追加
   - `channels:history`（スレッド元メッセージ取得）
   - `reactions:write`（リアクション追加）
2. Event Subscriptions有効化
   - Request URL: GASのWebアプリURL
   - Subscribe to bot events: `message.channels`
3. BotをDM通知チャンネルに招待

### Instagram設定
- `instagram_manage_messages`権限が必要

## 環境
### 本番環境
- [Spreadsheets]()
- [Google Apps Script]()

### 検証環境
- [Spreadsheets]()
- [Google Apps Script]()

## 検証方法

### DM受信
1. Instagram DMを送信
2. Slackに通知が届くことを確認
3. スプレッドシートにログが記録されることを確認

### DM返信
1. Slackで届いた通知のスレッドに返信
2. 返信メッセージに✅リアクションが付くことを確認
3. InstagramでDMが届くことを確認
4. スプレッドシートに返信ログが記録されることを確認

### エラー時
- LINEに通知が届くことを確認

## フロー図
- 処理全体のフロー図は `docs/flows.md` を参照

## 開発
開発手順については、[こちら](/README.md)を参照
