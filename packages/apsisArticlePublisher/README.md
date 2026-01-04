# apsisArticlePublisher

## 概要

スプレッドシートで管理している投稿予定記事リストから、明日投稿予定のApsis記事を自動的に処理するシステムです。

GitHubからMarkdownファイルと画像を取得し、microCMSに下書き保存した後、処理結果をDifyワークフローで通知します（成功時はSlack、失敗時はLINE）。

## 機能

### 主要機能

1. **対象記事の抽出**
   - スプレッドシートから以下の条件に合致する記事を取得
     - 投稿日が「明日」
     - プラットフォームが「Apsis」を含む
     - ステータスが「投稿準備完了」

2. **GitHub連携**
   - Markdownファイルの取得
   - フロントマター（title, author, tags, read_time等）の解析
   - 記事内で使用される画像の取得

3. **microCMS連携**
   - 画像のアップロード（1秒間に3回以下に制限）
   - 著者IDの取得
   - タグIDの取得
   - Markdownから画像パスをmicroCMS URLに置換
   - MarkdownをHTMLに変換
   - 記事を下書き保存

4. **処理結果の記録**
   - 成功時：スプレッドシートのステータスを「投稿済み」に更新
   - 失敗時：スプレッドシートのステータスを「失敗」に更新

5. **Dify通知**
   - 処理結果を各著者のDifyワークフローに通知
   - 成功時はSlack、失敗時はLINEに通知

### 処理フロー

```
1. スプレッドシートから対象記事を取得
   ↓
2. 各記事について以下を実行：
   a. GitHubからMarkdownファイルを取得
   b. フロントマターを解析
   c. GitHubから画像ファイルを取得
   d. microCMSに画像をアップロード
   e. 著者IDとタグIDを取得
   f. Markdown内の画像パスをmicroCMS URLに置換
   g. MarkdownをHTMLに変換
   h. microCMSに記事を下書き保存
   i. ステータスを「投稿済み」に更新（成功時）
      または「失敗」に更新（失敗時）
   ↓
3. 処理結果をDifyワークフローに通知
```

## 技術スタック

- **Google Apps Script (GAS)**: 実行環境
- **TypeScript**: 開発言語
- **GitHub Contents API**: Markdownと画像の取得
- **microCMS Management API**: 記事の投稿と画像アップロード
- **Dify Workflow API**: 処理結果の通知

## ディレクトリ構成

```
packages/apsisArticlePublisher/src/
├── index.ts                       # GASエントリーポイント（関数呼び出しのみ）
├── processArticles.ts             # 記事処理メインロジック
├── env.ts                         # 環境変数（スクリプトプロパティ取得）
├── constants.ts                   # 定数（microCMSエンドポイント名など）
├── types.ts                       # 型定義
├── spreadsheet/
│   ├── index.ts                  # スプレッドシート関連のエクスポート
│   ├── getTargetArticles.ts      # 対象記事取得
│   └── updateStatus.ts           # ステータス更新
├── github/
│   ├── index.ts                  # GitHub関連のエクスポート
│   ├── getMarkdownFile.ts        # Markdownファイル取得
│   ├── getImages.ts              # 画像ファイル取得
│   └── parseFrontmatter.ts       # フロントマター解析
├── microcms/
│   ├── index.ts                  # microCMS関連のエクスポート
│   ├── getAuthorId.ts            # 著者ID取得
│   ├── getTagIds.ts              # タグID取得
│   ├── uploadImage.ts            # 画像アップロード
│   ├── publishArticle.ts         # 記事投稿
│   └── replaceImagePaths.ts      # Markdown内の画像パス置換
├── dify/
│   ├── index.ts                  # Dify関連のエクスポート
│   └── notifyResults.ts          # 処理結果通知
└── utils/
    ├── index.ts                  # ユーティリティのエクスポート
    ├── dateUtils.ts              # 日付関連ユーティリティ
    ├── logger.ts                 # ログ出力
    └── markdownToHtml.ts         # Markdown→HTML変換
```

## 設定

### スクリプトプロパティ

以下の設定をGASスクリプトプロパティに登録する必要があります。

#### スプレッドシート設定

| プロパティ名 | 説明 | 例 |
|------------|------|---|
| `POSTING_DATE_COLUMN` | 投稿日列 | `C` |
| `AUTHOR_COLUMN` | 著者列 | `D` |
| `ARTICLE_TITLE_COLUMN` | 記事タイトル列 | `E` |
| `PLATFORM_COLUMN` | プラットフォーム列 | `F` |
| `STATUS_COLUMN` | ステータス列 | `G` |
| `BLOG_ARTICLE_LIST_SHEET_NAME` | シート名 | `記事管理` |

#### microCMS設定（全ユーザー共通）

| プロパティ名 | 説明 |
|------------|------|
| `MICRO_CMS_ENDPOINT_URL` | microCMSエンドポイントURL |
| `MICRO_CMS_API_KEY` | microCMS APIキー |

#### GitHub設定（著者別: USER_1, USER_2...）

| プロパティ名 | 説明 | 例 |
|------------|------|---|
| `USER_X` | 著者名 | `山田太郎` |
| `GITHUB_REPO_URL_X` | GitHubリポジトリURL | `https://github.com/user/repo` |
| `GITHUB_ARTICLE_PATH_X` | 記事ディレクトリパス | `articles` |
| `GITHUB_BRANCH_NAME_X` | ブランチ名 | `main` |
| `GITHUB_ACCESS_TOKEN_X` | GitHubアクセストークン | `ghp_xxxxx` |

※ Xはユーザー番号（1, 2, 3...）

#### Dify設定（著者別: USER_1, USER_2...）

| プロパティ名 | 説明 |
|------------|------|
| `DIFY_ENDPOINT_URL_X` | Difyワークフローエンドポイント |
| `DIFY_API_KEY_X` | Dify APIキー |

※ Xはユーザー番号（1, 2, 3...）

## トリガー設定

GASのトリガー機能を使用して、以下の設定で実行します。

- **実行する関数**: `publishArticlesToMicroCMS`
- **実行するデプロイ**: Head
- **イベントのソース**: 時間主導型
- **イベントの種類**: 日タイマー（例: 午前8時〜9時）

## 環境

### 本番環境
- [Spreadsheets]（リンクを追加してください）
- [Google Apps Script]（リンクを追加してください）

### 検証環境
- [Spreadsheets]（リンクを追加してください）
- [Google Apps Script]（リンクを追加してください）

## 検証方法

### 1. スプレッドシートの準備
以下の条件を満たす記事を1行追加します。
- 投稿日: 明日の日付
- プラットフォーム: `Apsis`を含む文字列
- ステータス: `投稿準備完了`
- 著者: スクリプトプロパティで設定した`USER_X`の値
- 記事タイトル: GitHubに存在する記事ディレクトリ名

### 2. GASの実行
GASエディタで`publishArticlesToMicroCMS`関数を実行します。

### 3. 結果確認
- スプレッドシートのステータスが「投稿済み」または「失敗」に更新されていることを確認
- microCMSの下書き一覧に記事が保存されていることを確認
- Dify通知（Slack/LINE）が送信されていることを確認

### 4. ログ確認
GASの実行ログで処理の詳細を確認します。
- `[INFO]`: 処理の進行状況
- `[WARN]`: 警告（例: タグが見つからない）
- `[ERROR]`: エラー

## 開発

開発手順については、[こちら](/README.md)を参照してください。

## 制限事項

### GAS制約
- **タイムアウト**: 6分（1回の実行で処理できる記事数に制限あり）
- **UrlFetchApp制限**:
  - レスポンスサイズ: 50MB/1コール
  - POSTアップロード: 最大10MB
  - 短時間連続リクエストで429エラー（1秒に4回以上）

### microCMS制約
- **画像サイズ**: 1ファイル最大5MB
- **画像アップロード**: 1リクエストで1ファイル

### GitHub Contents API制約
- **ファイル取得**: Base64エンコードされた状態で取得
- **ディレクトリ内ファイル一覧**: 最大1,000ファイル
- **ファイルサイズ**: 1MB以下は通常取得、1-100MBはrawモード、100MB以上は非対応

## エラーハンドリング

### 記事単位のエラー
1つの記事でエラーが発生しても、他の記事の処理は継続されます。
- 失敗した記事のステータスは「失敗」に更新
- エラー内容はログに出力
- Difyに失敗通知が送信される

### 致命的エラー
以下のエラーが発生した場合は処理全体が中断されます。
- スプレッドシートが見つからない
- microCMS/GitHub認証エラー
- スクリプトプロパティの設定不備

## 参考資料

- [開発プラン](./devPlan.md)
- [GitHub REST API - Repository Contents](https://developer.github.com/v3/repos/contents/)
- [microCMS - 画像アップロードAPI](https://blog.microcms.io/add-media-post-api/)
- [microCMS - リッチエディタのWRITE API](https://document.microcms.io/manual/rich-editor-write-api)
