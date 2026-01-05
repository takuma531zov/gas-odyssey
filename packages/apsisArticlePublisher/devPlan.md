## 概要
スプレッドシート(BLOG_ARTICLE_LIST_SHEET_NAME)で管理してる投稿予定記事リストから、本日投稿予定の記事をgithubからコンテンツ取得。
micro CMS投入→自動投稿→処理結果をユーザーに通知
上記の流れが実現するシステムを開発したい

## プロジェクト進捗状況
Difyで処理結果通知ワークフロー作成図済み（成功Slack、失敗LINE）

## このリポジトリ(GAS)の役目
対象条件にマッチする記事をgithubから探す。（対象条件は別途記載）
ファイルデータを取得→取得したデータを整形してmicroCMSに投入→自動公開 →処理結果をdify ワークフローに渡す

## 対象条件
POSTING_DATE_COLUMNが明日
&
PLATFORM_COLUMNが"Apsis"を含む
&
STATUS_COLUMNが"投稿準備完了"

## スプレッドシート構成
POSTING_DATE_COLUMN、PLATFORM_COLUMN、STATUS_COLUMN等のスプレッドシートの列やシート名に関することはスクリプトプロパティ値で管理。(env.tsに設定済み)

---

# 開発プラン

## 技術的実現可否調査結果

### ✅ GitHub Contents API
- **ファイル取得**: 可能（Base64エンコードされた状態で取得）
- **ディレクトリ内ファイル一覧**: 可能（最大1,000ファイル）
- **ファイルサイズ制限**: 1MB以下は通常取得、1-100MBはrawモード、100MB以上は非対応
- **必要な権限**: `Contents` (Read) のみで十分 ✅

参考: [GitHub REST API - Repository Contents](https://developer.github.com/v3/repos/contents/)

### ✅ microCMS API
1. **画像アップロード**: `POST /api/v1/media`
   - 1リクエストで1ファイル、最大5MB
   - APIキーに「メディアのアップロード」権限が必要
   - 参考: [microCMS - 画像アップロードAPI](https://blog.microcms.io/add-media-post-api/)

2. **予約公開**: Management APIで対応
   - `status` を `DRAFT` にして、`publishedAt` に未来の日時（ISO 8601形式）を指定
   - 参考: [microCMS - 予約公開設定](https://help.microcms.io/ja/knowledge/content-schedule)

3. **著者・タグ参照**: IDで参照フィールドとして指定

### ⚠️ GAS制約
- **タイムアウト**: 6分
- **UrlFetchApp制限**:
  - レスポンスサイズ：50MB/1コール
  - POSTアップロード：最大10MB
  - 実行回数：10万回/日
  - **短時間連続リクエストで429エラー**（1秒に4回以上）
- **対処法**: `fetchAll()` で並列処理、または `Utilities.sleep()` でリクエスト間隔を調整

参考: [GAS UrlFetchApp制限](https://auto-worker.com/blog/?p=5162)

### 📊 実現可否の結論
**全て実現可能**ですが、以下の注意点があります：
1. 画像サイズは5MB以下（microCMS制限）
2. 複数画像がある場合は順次アップロード（1秒に3回以下に制限）
3. 複数記事処理は可能だが、6分以内に完了する必要がある

---

## ディレクトリ構成

```
packages/apsisArticlePublisher/src/
├── index.ts                       # GASエントリーポイント（関数呼び出しのみ）
├── env.ts                         # 環境変数（スクリプトプロパティ取得）
├── constants.ts                   # 定数（microCMSエンドポイント名など）
├── types.ts                       # 型定義
├── spreadsheet/
│   ├── index.ts                  # スプレッドシート関連のエクスポート
│   ├── getTargetArticles.ts      # 対象記事取得
│   └── updateStatus.ts           # ステータス更新
├── github/
│   ├── index.ts                  # GitHub関連のエクスポート
│   ├── getMarkdownFile.ts        # マークダウンファイル取得
│   ├── getImages.ts              # 画像ファイル取得
│   └── parseFrontmatter.ts       # フロントマター解析
├── microcms/
│   ├── index.ts                  # microCMS関連のエクスポート
│   ├── getAuthorId.ts            # 著者ID取得
│   ├── getTagIds.ts              # タグID取得
│   ├── uploadImage.ts            # 画像アップロード
│   ├── publishArticle.ts         # 記事投稿
│   └── replaceImagePaths.ts      # マークダウン内の画像パス置換
├── dify/
│   ├── index.ts                  # Dify関連のエクスポート
│   └── notifyResult.ts           # 処理結果通知（後で実装）
└── utils/
    ├── index.ts                  # ユーティリティのエクスポート
    ├── dateUtils.ts              # 日付関連ユーティリティ
    ├── logger.ts                 # ログ出力
    └── markdownToHtml.ts         # マークダウン→HTML変換
```

### 各ファイルの責務

| ファイル | 役割 | 行数目安 |
|---------|------|---------|
| **index.ts** | メイン関数 `publishArticlesToMicroCMS()` のみ（トリガーで実行） | ~50行 |
| **constants.ts** | 定数（microCMSエンドポイント名など）ハードコーディング回避 | ~20行 |
| **types.ts** | 全体で使う型定義（Article, FrontMatter, GitHubFile等） | ~100行 |
| **spreadsheet/getTargetArticles.ts** | 明日 & Apsis & 投稿準備完了の記事行を取得 | ~80行 |
| **spreadsheet/updateStatus.ts** | ステータス列を「投稿済み」「投稿失敗」に更新 | ~30行 |
| **github/getMarkdownFile.ts** | GitHubからマークダウンファイルを取得 | ~60行 |
| **github/getImages.ts** | 画像フォルダから画像一覧と内容を取得 | ~80行 |
| **github/parseFrontmatter.ts** | フロントマター解析（title, author, tags, read_time等） | ~100行 |
| **microcms/getAuthorId.ts** | 著者名（member_name）からIDを取得 | ~60行 |
| **microcms/getTagIds.ts** | タグslug配列からID配列を取得 | ~80行 |
| **microcms/uploadImage.ts** | 画像をmicroCMSにアップロード（1秒に3回制限） | ~80行 |
| **microcms/replaceImagePaths.ts** | `![](image.png)` → microCMS URLに置換 | ~60行 |
| **microcms/publishArticle.ts** | microCMSに記事を予約公開（明日4:00） | ~100行 |
| **dify/notifyResult.ts** | 処理結果をDifyに通知（後で実装） | ~80行 |
| **utils/dateUtils.ts** | 明日の日付、明日4:00のISO文字列取得 | ~40行 |
| **utils/logger.ts** | 統一されたログ出力 | ~30行 |
| **utils/markdownToHtml.ts** | マークダウン→HTML変換（基本的な変換をサポート） | ~150行 |

---

## 処理フロー

### メイン処理フロー

```
publishArticlesToMicroCMS() {
  1. 対象記事を取得（明日 & Apsis & 投稿準備完了）
  2. 各記事について：
     a. try {
        - GitHubからマークダウンファイル取得
        - フロントマター解析
        - GitHubから画像ファイル取得
        - microCMSに画像アップロード（ファイル名→URLマッピング作成）
        - 著者ID取得
        - タグID配列取得
        - マークダウン内の画像パス置換
        - マークダウンをHTMLに変換
        - microCMSに記事を予約公開（明日4:00）
        - ステータスを「投稿済み」に更新
     }
     b. catch (error) {
        - ステータスを「投稿失敗」に更新
        - エラーログ出力
     }
  3. 処理完了ログ出力
}
```

### 各ステップの詳細仕様

#### 1️⃣ 対象記事取得 (`spreadsheet/getTargetArticles.ts`)
- スプレッドシートから全行取得（`getRowData2D()` 使用）
- 条件フィルタリング：
  - POSTING_DATE_COLUMN が明日（`dateUtils.getTomorrow()`）
  - PLATFORM_COLUMN に "Apsis" が含まれる
  - STATUS_COLUMN が "投稿準備完了"
- 戻り値：`{ rowIndex: number, title: string, author: string }[]`

#### 2️⃣ GitHubファイル取得 (`github/`)

**マークダウンファイル** (`getMarkdownFile.ts`)
- パス: `/{GITHUB_ARTICLE_PATH}/{title}/{title}.md`
- GitHub Contents API: `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`
- Base64デコードして文字列として返す

**画像ファイル** (`getImages.ts`)
- パス: `/{GITHUB_ARTICLE_PATH}/{title}/Images/`
- GitHub Contents API: `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`
- ディレクトリ内の全ファイル取得（配列で返る）
- 各ファイルをBase64デコードしてBlobとして返す
- 戻り値: `{ filename: string, blob: Blob }[]`

#### 3️⃣ フロントマター解析 (`github/parseFrontmatter.ts`)
- マークダウンから `---` で囲まれた部分を抽出
- YAML風に解析（手動パース）
- 抽出項目：
  - `title`: string（必須）
  - `author`: string（必須）
  - `tags`: string[]（オプション、デフォルト: []）
  - `read_time`: string（オプション、デフォルト: "3分"）
  - `status`: string
- コンテンツ部分（フロントマター以外）も返す

#### 4️⃣ 画像アップロード (`microcms/uploadImage.ts`)
- 各画像をmicroCMSにアップロード
- `POST https://{serviceId}.microcms-management.io/api/v1/media`
- Headers: `{ "X-MICROCMS-API-KEY": apiKey }`
- Body: FormData { file: Blob }
- レスポンス: `{ url: string, ... }`
- 戻り値: `Map<filename, url>`
- **注意**: 1秒に3回以下に制限（`Utilities.sleep(350)`）

#### 5️⃣ 著者ID取得 (`microcms/getAuthorId.ts`)
- `GET https://{serviceId}.microcms.io/api/v1/profile`
- Headers: `{ "X-MICROCMS-API-KEY": apiKey }`
- レスポンス: `{ contents: [ { id, member_name, ... } ] }`
- `member_name` で検索してIDを返す
- 見つからない場合：エラーをthrow

#### 6️⃣ タグID取得 (`microcms/getTagIds.ts`)
- `GET https://{serviceId}.microcms.io/api/v1/tags`
- Headers: `{ "X-MICROCMS-API-KEY": apiKey }`
- レスポンス: `{ contents: [ { id, slug, ... } ] }`
- 各タグslugで検索してID配列を返す
- 見つからないタグ：警告ログ、スキップ

#### 7️⃣ 画像パス置換 (`microcms/replaceImagePaths.ts`)
- マークダウン内の `![alt](filename.png)` を検索
- 正規表現: `/!\[([^\]]*)\]\(([^)]+)\)/g`
- ファイル名→URLマッピングから置換
- 見つからない画像：警告ログ

#### 8️⃣ マークダウンをHTMLに変換 (`utils/markdownToHtml.ts`)
- `markdownToHtml(markdown: string): string` 関数を使用
- 基本的なマークダウン記法をHTMLに変換
- リッチエディタのWRITE APIに対応した形式

#### 9️⃣ microCMS記事投稿 (`microcms/publishArticle.ts`)
- `POST https://{serviceId}.microcms.io/api/v1/{endpoint}`
- Headers:
  ```json
  {
    "X-MICROCMS-API-KEY": apiKey,
    "Content-Type": "application/json"
  }
  ```
- Body:
  ```json
  {
    "title": "記事タイトル",
    "author": "author_id",
    "content": "HTML変換済みコンテンツ",
    "tag": ["tag_id1", "tag_id2"],
    "read_time": ["3分"],
    "excerpt": "記事概要（オプション）",
    "status": "DRAFT",
    "publishedAt": "2026-01-04T04:00:00+09:00"
  }
  ```
- 予約公開時刻：明日の4:00（ISO 8601形式）

#### 🔟 ステータス更新 (`spreadsheet/updateStatus.ts`)
- 成功時：「投稿済み」
- 失敗時：「投稿失敗」
- `setValueSheet()` を使用

---

## エラーハンドリング設計

### エラーの種類と対応方針

| エラー種類 | 発生箇所 | 対応 |
|-----------|---------|------|
| **シートが見つからない** | スプレッドシート取得 | 致命的エラー、処理中断、エラーログ |
| **対象記事が0件** | 対象記事フィルタリング | 正常終了、情報ログ出力 |
| **GitHubファイルが見つからない** | マークダウン/画像取得 | 記事単位でエラー、ステータス「投稿失敗」 |
| **GitHub認証エラー** | GitHub API呼び出し | 致命的エラー、処理中断 |
| **GitHubレート制限** | GitHub API呼び出し | リトライ（最大3回、指数バックオフ） |
| **フロントマター必須フィールド不足** | フロントマター解析 | 記事単位でエラー、ステータス「投稿失敗」 |
| **タグ・read_time無し** | フロントマター解析 | デフォルト値で継続（tags=[], read_time="3分"） |
| **著者が見つからない** | 著者ID取得 | 記事単位でエラー、ステータス「投稿失敗」 |
| **タグが一部見つからない** | タグID取得 | 警告ログ、見つかったタグのみで継続 |
| **画像アップロード失敗** | 画像アップロード | 記事単位でエラー、ステータス「投稿失敗」 |
| **記事投稿失敗** | microCMS記事投稿 | 記事単位でエラー、ステータス「投稿失敗」 |
| **microCMS認証エラー** | microCMS API呼び出し | 致命的エラー、処理中断 |
| **6分タイムアウト** | 全体処理 | GAS制約、処理済み記事はステータス更新済みなので再実行可能 |

### エラーログ形式

```typescript
// エラーログ
Logger.log(`[ERROR] 記事: ${title}, ステップ: ${step}, エラー: ${error.message}`);

// 警告ログ
Logger.log(`[WARN] 記事: ${title}, メッセージ: ${message}`);

// 情報ログ
Logger.log(`[INFO] ${message}`);
```

### リトライロジック

**対象エラーコード**:
- `429` (Too Many Requests)
- `503` (Service Unavailable)
- ネットワークエラー

**リトライ仕様**:
- 最大3回リトライ
- 指数バックオフ: 1秒、2秒、4秒
- 3回失敗後は記事単位でエラーとして扱う

### 記事単位のエラーハンドリング

各記事の処理は独立しており、1つの記事でエラーが発生しても他の記事の処理は継続します。

```typescript
for (const article of targetArticles) {
  try {
    // 記事処理
    updateStatus(article.rowIndex, "投稿済み");
  } catch (error) {
    Logger.log(`[ERROR] 記事: ${article.title}, エラー: ${error.message}`);
    updateStatus(article.rowIndex, "投稿失敗");
    // 次の記事に進む
  }
}
```

---

## 実装方針（確定事項）

### ✅ 1. マークダウン→HTML変換
microCMSのリッチエディタはWRITE APIでHTML文字列を直接受け付けます。
- **実装方針**: `utils/markdownToHtml.ts` で基本的な変換ロジックを実装
- **サポート対象**:
  - 見出し（`#`, `##`, `###`, `####`, `#####`, `######`）
  - 太字（`**text**`、`__text__`）
  - イタリック（`*text*`、`_text_`）
  - 打ち消し線（`~~text~~`）
  - インラインコード（`` `code` ``）
  - コードブロック（` ```language ... ``` `）
  - リスト（`-`, `*`, `1.`）
  - 引用（`>`）
  - リンク（`[text](url)`）
  - 画像（`![alt](url)` - 既に置換済み）
  - 改行・段落

参考:
- [リッチエディタのWRITE API](https://document.microcms.io/manual/rich-editor-write-api)
- [リッチエディタにHTMLのままインポート](https://help.microcms.io/ja/knowledge/html-import-new-rich-editor)

### ✅ 2. microCMSのエンドポイント名管理
**確定エンドポイント名**:
- 記事投稿先: `blogs`
- 著者マスタ: `profile`
- タグマスタ: `tags`

**実装方針**:
- `constants.ts` で定数管理（ハードコーディング回避）
- ベースURL（`https://xxxxx.microcms.io/api/v1/`）は `env.ts` で管理
- 各APIコールで動的にURL生成：`${MICRO_CMS_ENDPOINT_URL}${MICROCMS_ENDPOINTS.BLOGS}`

```typescript
// constants.ts
export const MICROCMS_ENDPOINTS = {
  BLOGS: "blogs",
  PROFILE: "profile",
  TAGS: "tags",
} as const;
```

### 📋 3. Dify通知機能
- 基本機能完成後に実装予定
- 現在のdify関連ファイルはスキップ

---

## 開発順序

1. **フェーズ1: 基盤構築**
   - constants.ts（定数定義）
   - types.ts（型定義）
   - utils/logger.ts（ログ出力）
   - utils/dateUtils.ts（日付関連）
   - utils/markdownToHtml.ts（マークダウン→HTML変換）

2. **フェーズ2: スプレッドシート関連**
   - spreadsheet/getTargetArticles.ts
   - spreadsheet/updateStatus.ts

3. **フェーズ3: GitHub関連**
   - github/getMarkdownFile.ts
   - github/getImages.ts
   - github/parseFrontmatter.ts

4. **フェーズ4: microCMS関連**
   - microcms/getAuthorId.ts
   - microcms/getTagIds.ts
   - microcms/uploadImage.ts
   - microcms/replaceImagePaths.ts
   - microcms/publishArticle.ts

5. **フェーズ5: メイン処理**
   - index.ts（全体の統合）

6. **フェーズ6: Dify通知（後で実装）**
   - dify/notifyResult.ts（スキップ）

---

## テスト計画

### 単体テスト（手動）
- 各関数を個別にテスト
- GAS実行ログで確認

### 結合テスト
- 実際のスプレッドシート、GitHub、microCMSを使用
- テスト記事で動作確認

### エラーケーステスト
- 存在しないファイルパス
- 不正なフロントマター
- 存在しない著者/タグ
- 画像アップロード失敗シミュレーション

---

