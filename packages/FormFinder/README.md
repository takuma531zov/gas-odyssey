# FormFinder - 営業リスト問い合わせフォーム抽出システム

## 概要

企業のホームページURLから問い合わせフォームを自動抽出し、フォーム構造データを取得するGoogle Apps Script（GAS）システムです。

## 機能

- 🔍 **自動フォーム抽出**: 正規表現とキーワードマッチングによる高精度抽出
- 🤖 **フォーム内容判定**: 問い合わせフォームと他フォームの区別（Newsletter、検索フォーム等を除外）
- 📊 **構造解析**: フォームフィールドの詳細情報を取得  
- 🏃 **Googleフォーム優先**: Google Formsリンクを中間ページで検出し直接処理
- 📝 **スプレッドシート連携**: Google Sheetsとの完全統合（エラー分類色分け対応）
- ⚡ **バッチ処理**: 大量データの効率的処理

## 必要環境

- Google Apps Script
- Google Spreadsheet
- Node.js 18+
- pnpm
- TypeScript 5.0+

## セットアップ

### 1. 開発環境準備

```bash
# 依存関係インストール
pnpm install

# TypeScriptコンパイル
npm run build

# GASにデプロイ
npm run deploy
```

### 2. スプレッドシート準備

| 列 | 用途 | 説明 |
|---|---|---|
| L列 | 企業ホームページURL | 入力データ（必須） |
| AP列 | 問い合わせフォームURL | 出力先（自動入力）・エラー時背景色変更 |
| AS列 | フォーム構造データ | 出力先（JSON形式） |
| AT列 | エラーステータス | エラー詳細メッセージ出力先 |

## 使用方法

### 基本的な実行

```javascript
function main() {
  runFormFinder();
}
```

### 設定確認

```javascript
function checkConfig() {
  debugSpreadsheet();
}
```

## 処理フロー

### 📋 基本的な流れ

```
1️⃣ スプレッドシートから企業URLリストを読み込み
    ↓
2️⃣ 各企業のURLに対して問い合わせページを探す
    ↓
3️⃣ 見つかったページでフォームを分析
    ↓
4️⃣ 結果をスプレッドシートに保存
```

### 🔍 詳細な処理ステップ

**Step1: 対象リスト抽出**
- スプレッドシートのL列（企業URL）を読み込み
- 未処理の行を特定

**Step2: 問い合わせページを探す**
- 企業URL + よくあるパス（/contact, /inquiry など）でアクセス
- ✅ 見つかった場合
  - 🏃 **Googleフォーム優先**: ページ内にGoogleフォームリンクがあれば直接Step5へ
  - 📝 通常フォーム: Step3でフォーム分析へ
- ❌ 見つからない場合 → Step4へ

**Step3: フォーム分析**
- ページにフォームがあるかチェック
- 問い合わせフォームかどうか判定（メール欄、問い合わせ欄があるか等）
- ✅ 問い合わせフォーム → 🟢 結果保存
- ⚠️ 他のフォーム（ニュースレター等） → 🔴 警告付きで保存

**Step4: トップページを調べる**
- 企業のトップページにアクセス
- フォームがあるかチェック or Googleフォームリンクを探す

**Step5: Googleフォーム検出**
- Google FormsのURLを見つけて直接アクセス
- ✅ 見つかった場合 → 🟢 結果保存

**Step6: エラー処理**
- どこでもフォームが見つからない場合
- ⚫ グレー背景で「見つかりませんでした」

### 🎯 結果の色分け

| 結果 | 背景色 | 意味 |
|------|--------|------|
| 🟢 成功 | なし | 問い合わせフォーム発見！ |
| 🔴 警告 | 赤色 | フォームはあるけど問い合わせ用じゃないかも |
| ⚫ エラー | グレー | フォームが見つからなかった |

## フォーム判定ロジック

### 問い合わせフォーム判定基準（スコアリング）

| 項目 | 条件 | 得点 |
|---|---|---|
| **問い合わせキーワード** | 周辺テキストに「お問い合わせ」「連絡」「相談」等 | +2点 |
| **必須フィールド組み合わせ** | email + message/inquiry フィールド両方存在 | +3点 |
| **基本フィールド** | name, company フィールド各1つ毎 | +1点 |
| **送信ボタン** | 「送信」「問い合わせ」「相談」等のテキスト | +1点 |
| **除外パターン** | newsletter, search, login 等のキーワード | -2点 |

**判定基準**: 4点以上で問い合わせフォームと判定

### エラー分類と背景色

| エラー種別 | 背景色 | メッセージ例 |
|---|---|---|
| **フォーム存在・非問い合わせ** | 🔴 赤色 (#ffcccc) | 問い合わせフォームではない可能性あり |
| **フォーム未発見** | ⚫ グレー (#e0e0e0) | 問い合わせページが見つかりませんでした |

## 出力データ形式

### AP列（問い合わせフォームURL）
```
https://example.com/contact
```

### AS列（フォーム構造データ）
```json
{
  "formAction": "https://example.com/send",
  "method": "POST",
  "fields": [
    {
      "name": "company",
      "type": "text",
      "id": "company_name",
      "required": true,
      "label": "会社名"
    },
    {
      "name": "email",
      "type": "email",
      "required": true,
      "label": "メールアドレス"
    }
  ],
  "submitButton": "送信"
}
```

### AT列（エラーステータス）
```
問い合わせページが見つかりませんでした
問い合わせフォームではない可能性あり
処理中にエラーが発生しました
```

## 設定項目

### 抽出キーワード
```typescript
const CONTACT_KEYWORDS = [
  'contact', 'contactus', 'inquiry', 'form',
  'otoiawase', 'toiawase', 'soudan', 'support',
  'inquery', 'request', 'ask', 'question'
];
```

### Googleフォーム検出パターン
```typescript
const GOOGLE_FORM_PATTERNS = [
  'docs.google.com/forms',
  'forms.google.com', 
  'forms.gle',
  'goo.gl/forms'
];
```

## ファイル構成

```
src/
├── index.ts                          # メイン処理・6ステップフロー制御
├── types.ts                         # 型定義
├── services/
│   ├── step1-target-list.ts         # Step1: 対象リスト抽出
│   ├── step2-keyword-access.ts      # Step2: キーワード付きURL順次アクセス
│   ├── step3-form-extraction.ts     # Step3: フォーム要素抽出・内容判定
│   ├── step4-top-page-analysis.ts   # Step4: トップページHTML取得・解析
│   ├── step5-google-form-detection.ts # Step5: Googleフォーム検出・抽出
│   ├── step6-error-status.ts        # Step6: エラーステータス出力
│   └── spreadsheet.ts              # スプレッドシート操作
└── utils/
    ├── constants.ts                 # 定数定義・キーワード管理
    ├── logger.ts                    # ログ出力
    ├── url.ts                       # URL操作
    └── env.ts                       # 環境変数管理
```

## トリガー設定

手動実行またはタイマートリガーで定期実行可能：
- 実行する関数：`runFormFinder`
- 実行するデプロイ：最新版
- イベントのソース：時間主導型
- イベントの種類：時間ベースのタイマー

## トラブルシューティング

### よくある問題

1. **「問い合わせページが見つかりませんでした」（グレー背景）**
   - 対象サイトに問い合わせフォームが存在しない
   - フォームがJavaScriptで動的生成されている
   - アクセスが制限されている

2. **「問い合わせフォームではない可能性あり」（赤背景）**
   - Newsletter登録フォームなど他の用途のフォーム
   - 検索フォームやログインフォーム
   - 問い合わせ関連キーワードが不足

3. **「処理中にエラーが発生しました」**
   - ネットワーク接続エラー
   - レート制限に抵触
   - HTMLパースエラー

### ログ確認

GASエディタの実行ログで詳細情報を確認：

```javascript
// デバッグ用関数
function debugSpreadsheet() {
  // スプレッドシート情報とターゲット行を確認
}
```

## 注意事項

- GASの実行時間制限（6分）に注意
- 大量処理時はレート制限を考慮（行間500ms待機）
- 対象サイトのrobots.txtを遵守
- JavaScriptで動的生成されるフォームは検出不可

## 開発

### ビルド

```bash
npm run build
```

### 監視モード

```bash
npm run watch
```

### デプロイ

```bash
npm run deploy
```

開発手順については、[FormFinder.md](./FormFinder.md)を参照
