## 概要
Instagram DMをSlackへ自動通知し、実行ログをスプレッドシートに記録します。
Instagram APIトークンの自動更新機能付き。

## 機能
1. Instagram Webhook受信（doGet: 検証、doPost: 処理）
2. DM内容解析（エコー・既読をスキップ）
3. Instagram Graph APIでユーザー情報取得
4. Slackへメッセージ送信
5. スプレッドシートへログ出力
6. エラー時LINE通知
7. Instagram APIトークン自動更新


## トリガー設定
- 実行する関数：`doGet` / `doPost`（ウェブアプリ）
- 実行するデプロイ：本番/検証のデプロイIDを指定
- イベントのソース：ウェブアプリ
- イベントの種類：アクセス時

## 環境変数（スクリプトプロパティ）
- `INSTAGRAM_VERIFY_TOKEN`: Instagram Webhook検証トークン
- `INSTAGRAM_API_TOKEN`: Instagram Graph APIアクセストークン（自動更新）
- `SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL
- `LOG_SHEET_NAME`: ログ出力先シート名
- `LINE_API_TOKEN`: LINE Messaging APIトークン
- `LINE_BOT_ID`: LINE通知先ユーザーID

## ログ形式
| タイムスタンプ | 送信者ID | 送信者名 | ユーザー名 | メッセージ | ステータス | 詳細 |
|-------------|---------|---------|----------|-----------|----------|------|

## 環境
### 本番環境
- [Spreadsheets]()
- [Google Apps Script]()

### 検証環境
- [Spreadsheets]()
- [Google Apps Script]()

## 検証方法
1. Instagram DMを送信
2. Slackに通知が届くことを確認
3. スプレッドシートにログが記録されることを確認
4. エラー時にLINEに通知が届くことを確認

## 開発
開発手順については、[こちら](/README.md)を参照
