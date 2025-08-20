# URLFinder - 企業問い合わせページ自動検索システム

BtoB営業活動を効率化する、企業サイトからの問い合わせページ自動検索ツールです。Google Apps Script（GAS）環境で動作し、スプレッドシートと連携して大量のURLを効率的に処理できます。

## 📖 目次

- [概要](#概要)
- [主要機能](#主要機能)
- [システム要件](#システム要件)
- [セットアップ](#セットアップ)
- [使用方法](#使用方法)
- [設定項目](#設定項目)
- [アーキテクチャ](#アーキテクチャ)
- [開発者向け情報](#開発者向け情報)
- [トラブルシューティング](#トラブルシューティング)

## 概要

URLFinderは企業のWebサイトから問い合わせページを自動的に発見・抽出するシステムです。BtoB営業チームが効率的にリード獲得を行うために開発されました。

### 🎯 解決する課題

- **手動での問い合わせページ探索の非効率性**
- **大量の企業サイト調査にかかる時間コスト**
- **営業活動の初期段階でのボトルネック**

### 🚀 提供価値

- **作業時間の大幅短縮**: 手動調査と比較して90%以上の時間削減
- **高精度な検索**: 複数のアルゴリズムによる包括的な検索
- **スケーラブルな処理**: 数百〜数千のURLを一括処理

## 主要機能

### 🔍 多段階検索アルゴリズム

1. **URLパターン推測検索**
   - 一般的な問い合わせページURLパターンによる高速検索
   - `/contact`, `/inquiry`, `/support` 等の規則的なパターン

2. **HTML解析フォールバック検索**
   - ホームページのHTML構造を解析
   - ナビゲーションメニューやリンクテキストから検索

3. **最終フォールバック処理**
   - 上記手法で発見できない場合の代替候補提示

### 📊 対応フォーム形式

- **従来型HTMLフォーム**: 標準的なform要素
- **Google Forms**: Googleフォーム統合
- **埋め込みフォーム**: サードパーティフォームウィジェット
- **SPA（Single Page Application）**: JavaScript動的フォーム

### 🖥️ ユーザーインターフェース

- **スプレッドシート統合**: 直感的なデータ入出力
- **進捗表示UI**: リアルタイムの処理状況確認
- **選択的処理**: チェックボックスによる対象行指定
- **エラーハンドリング**: 詳細なエラー情報提供

## システム要件

### 必須環境

- **Google Apps Script**: 実行環境
- **Google Spreadsheet**: データ管理
- **インターネット接続**: 外部サイトアクセス

### 推奨設定

- **処理件数**: 一度に50件まで（タイムアウト対策）
- **タイムアウト設定**: 30秒（大規模サイト対応）

## セットアップ

### 1. プロジェクトの準備

```bash
# 開発環境での準備（開発者向け）
cd packages/URLFinder
npm install
npm run build
```

### 2. GASプロジェクトの設定

1. **新しいGASプロジェクトを作成**
2. **生成されたファイルをアップロード**
   - `dist/main.js` → `Code.js`
   - `dist/simple-options.html` → HTMLファイル
   - `dist/progress.html` → HTMLファイル

### 3. スクリプトプロパティの設定

以下の設定をGASエディタの「プロジェクトの設定」→「スクリプトプロパティ」で行います：

#### GASスクリプトプロパティ設定(必須)

```
SHEET: "リスト"                    # 処理対象のシート名
MAX_COUNT: "30"                      # 一度に処理する最大件数
HEADER_ROW: "3"                      # ヘッダー行番号
TARGET_COLUMN: "12"                  # URL取得列（L列=12）
OUTPUT_COLUMN: "42"                  # 結果出力列（AP列=42）
CHECK_COLUMN: "43"                   # チェックボックス列（AQ列=43）
MAX_TOTAL_TIME: "100000"              # 全体処理タイムアウト（ミリ秒）
```

#### アプリ内設定値（未設定時はデフォルト値使用）

```
FETCH_TIMEOUT: "7000"                # HTTP通信タイムアウト（ミリ秒）
HIGH_CONFIDENCE_THRESHOLD: "80"      # 高信頼度判定スコア
MEDIUM_CONFIDENCE_THRESHOLD: "60"    # 中信頼度判定スコア
MINIMUM_ACCEPTABLE_THRESHOLD: "40"   # 最小許容スコア
```

### 4. スプレッドシートの準備

| 列 | 内容 | 例 |
|----|------|-----|
| L列 | 検索対象URL | `https://example.com` |
| AP列 | 検索結果 | `https://example.com/contact` |
| AQ列 | チェックボックス | ☑️ |

## 使用方法

### 基本的な使い方

1. **URLの準備**
   - L列に検索対象のURLを入力
   - ヘッダー行（通常1行目）は処理対象外

2. **実行方法の選択**

   #### 方法A: 全体処理
   ```javascript
   processContactPageFinder(); // GASエディタから実行
   ```

   #### 方法B: UI付き実行
   ```javascript
   executeUrlFinderWithUI(); // ダイアログ表示
   ```

3. **結果の確認**
   - AP列に検索結果が出力されます
   - エラーの場合は詳細メッセージが表示されます

### 高度な使用方法

#### チェック行のみ処理

```javascript
executeCheckedRowsProcessing(); // AQ列でチェックされた行のみ処理
```

#### 単体テスト

```javascript
test(); // 特定URLでのテスト実行
```

#### プログラマティックな呼び出し

```javascript
const result = findContactPage('https://example.com');
console.log(result.contactUrl);     // 問い合わせページURL
console.log(result.searchMethod);   // 使用された検索手法
console.log(result.foundKeywords);  // 発見されたキーワード
```

## 設定項目

### 列設定の変更

スプレッドシートの列構成を変更する場合は、スクリプトプロパティを更新してください：

```javascript
// 例：URL列をB列（2）、結果列をZ列（26）に変更
PropertiesService.getScriptProperties().setProperties({
  'TARGET_COLUMN': '2',   // B列
  'OUTPUT_COLUMN': '26'   // Z列
});
```

### パフォーマンス調整

#### 処理件数の調整
```javascript
// 大量データ処理時は件数を制限
PropertiesService.getScriptProperties().setProperty('MAX_COUNT', '30');
```

#### タイムアウト調整
```javascript
// 重いサイト対応のためタイムアウトを延長
PropertiesService.getScriptProperties().setProperties({
  'MAX_TOTAL_TIME': '100000',  // 1分40秒　GASスクリプトプロパティで設定
  'FETCH_TIMEOUT': '10000'    // 10秒
});
```

### 検索精度調整

#### 閾値の調整
```javascript
// より厳密な検索条件
PropertiesService.getScriptProperties().setProperties({
  'HIGH_CONFIDENCE_THRESHOLD': '90',
  'MEDIUM_CONFIDENCE_THRESHOLD': '70',
  'MINIMUM_ACCEPTABLE_THRESHOLD': '50'
});
```

## アーキテクチャ

### 🏗️ システム構成

```
URLFinder/
├── src/
│   ├── ContactPageFinder.ts       # メイン検索ロジック
│   ├── gas-integration.ts         # GAS統合機能
│   ├── index.ts                   # エントリーポイント
│   ├── env.ts                     # 環境設定管理
│   ├── modules/                   # 機能モジュール群
│   │   ├── initialization/        # 初期化・検証
│   │   ├── step2Analysis/         # HTML解析
│   │   ├── fallbackSystem/        # フォールバック処理
│   │   ├── formValidation/        # フォーム検証
│   │   ├── linkAnalysis/          # リンク解析
│   │   ├── httpUtils/             # HTTP通信
│   │   └── spaAnalysis/           # SPA対応
│   ├── analyzers/                 # 解析エンジン
│   ├── strategies/                # 検索戦略
│   ├── utils/                     # ユーティリティ
│   └── types/                     # 型定義
└── dist/                          # ビルド出力
```

### 🔄 処理フロー

```
URLリスト → 初期化・検証 → SNS判定 → URLパターン検索 → HTML解析 → 最終フォールバック → 結果出力
```

### 🧩 主要コンポーネント

#### ContactPageFinder
- **役割**: メイン検索ロジック
- **機能**: 多段階検索アルゴリズムの統合実行
- **設計**: 状態管理とモジュール連携

#### Environment
- **役割**: 設定管理
- **機能**: スクリプトプロパティの一元管理
- **特徴**: 必須設定とデフォルト値の適切な分離

#### GAS Integration
- **役割**: Google Apps Script連携
- **機能**: スプレッドシート操作、UI提供
- **特徴**: 柔軟な列設定、エラーハンドリング

## 開発者向け情報

### 🛠️ 開発環境セットアップ

```bash
# 依存関係のインストール
npm install

# 開発用ビルド（ウォッチモード）
npm run dev

# 本番用ビルド
npm run build

# 型チェック
npm run type-check

# リント
npm run lint
```

### 📝 コーディング規約

#### TypeScript設定
- **厳密な型チェック**: `strict: true`
- **ES2019ターゲット**: GAS互換性確保
- **モジュールシステム**: ES Modules + CommonJS出力

#### アーキテクチャ原則
- **単一責任原則**: 1ファイル150-300行目安
- **依存性逆転**: インターフェース経由の結合
- **関数型指向**: 純粋関数の積極活用

### 🔧 ビルドシステム

#### esbuild設定
```javascript
// esbuild.config.js
{
  bundle: true,
  platform: "node",
  target: "es2019",
  format: "cjs",
  plugins: [GasPlugin],
  // GAS互換性確保のための後処理
}
```

#### 出力最適化
- **CommonJS除去**: `module.exports` 自動削除
- **HTMLファイル**: 自動コピー処理
- **バンドルサイズ**: 最適化済み

### 🧪 テスト戦略

#### 単体テスト
```javascript
// テスト実行
function testSingleUrl() {
  const result = findContactPage('https://example.com');
  console.log('Test Result:', result);
}
```

#### 統合テスト
```javascript
// 実際のスプレッドシートでのテスト
function integrationTest() {
  processContactPageFinder();
}
```

### 📊 パフォーマンス考慮事項

#### メモリ使用量
- **最大同時処理**: 50URL
- **キャッシュ戦略**: 同一ドメイン判定結果
- **ガベージコレクション**: 適切なオブジェクト解放

#### ネットワーク最適化
- **HTTP/2対応**: 可能な場合は使用
- **タイムアウト管理**: 段階的タイムアウト設定
- **レート制限**: 同一ドメインへの過度なリクエスト防止

## トラブルシューティング

### よくある問題と解決方法

#### 🚫 関数が認識されない
```
エラー: 関数processContactPageFinderが見つかりません
```
**解決方法**:
1. `dist/main.js`が正しくアップロードされているか確認
2. GASエディタでリロードを実行
3. 関数リストの更新を待つ

#### ⏱️ タイムアウトエラー
```
エラー: タイムアウトが発生しました
```
**解決方法**:
1. MAX_COUNTを削減（例：50 → 30）
2. MAX_TOTAL_TIMEを延長（例：100000 → 200000）
3. 重いサイトを除外

#### 📊 スクリプトプロパティエラー
```
エラー: TARGET_COLUMN プロパティが設定されていません
```
**解決方法**:
1. GASエディタ → プロジェクトの設定 → スクリプトプロパティ
2. 必須プロパティを設定
3. 値は数字の文字列で設定（例："12"）

#### 🔍 検索結果が見つからない
```
結果: 問い合わせフォームが見つかりませんでした
```
**考えられる原因**:
- サイトがJavaScriptを多用している
- 非標準的なフォーム実装
- アクセス制限（bot検出）

**対策**:
1. 閾値を下げる（MINIMUM_ACCEPTABLE_THRESHOLD）
2. 手動確認による検証
3. サイト構造の個別調査

### 🔧 デバッグ方法

#### ログ確認
```javascript
// GASエディタの実行ログを確認
console.log('Debug info:', result);
```

#### 段階的テスト
```javascript
// 単一URLでのテスト
const result = findContactPage('https://problematic-site.com');
console.log('Result:', result);
```

#### 設定値確認
```javascript
// 現在の設定値を確認
const properties = PropertiesService.getScriptProperties().getProperties();
console.log('Current settings:', properties);
```

---

## 📞 サポート

技術的な質問や問題が発生した場合は、開発チームまでお問い合わせください。

**システム情報**:
- Version: 1.0.0
- Platform: Google Apps Script
- Language: TypeScript
- Build Tool: esbuild
