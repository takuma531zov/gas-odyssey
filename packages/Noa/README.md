# Noa - レシート・クレジットカード明細OCR自動処理システム

## 概要

NoaはGoogle Apps Script (GAS) で動作するOCR自動処理システムです。レシート画像やクレジットカード明細（画像/CSV）から必要な情報を自動抽出し、Googleスプレッドシートに整理して出力します。

## 主要機能

### 1. レシート処理
- **画像OCR**: Google Cloud Vision APIを使用してレシート画像からテキストを抽出
- **HEIC対応**: iPhone写真（HEIC形式）をJPEGに自動変換してOCR処理
- **情報抽出**: OpenAI APIを使用して以下の情報を自動抽出
  - 店舗名
  - 日付
  - 合計金額（税込）
  - 税率別金額（8%/10%）
  - 軽減税率対象の有無

### 2. クレジットカード明細処理
- **画像OCR**: クレジットカード明細の画像をOCR処理
- **CSV処理**: CSVファイルから明細データを直接インポート
- **情報抽出**: 以下の情報を自動抽出・整理
  - 引き落とし日（当月平日最終日を自動設定）
  - 店舗名
  - 品目
  - カード名
  - 利用日
  - 金額

### 3. 自動ファイル管理
- **自動振り分け**: 処理済み/エラーファイルを自動的に別フォルダへ移動
- **バッチ処理**: フォルダ内の全ファイルを一括処理
- **エラーハンドリング**: 処理失敗ファイルを専用フォルダで管理

## システム構成

```
packages/Noa/
├── src/
│   ├── index.ts           # メインエントリーポイント
│   ├── ocr.ts             # OCR処理（Vision API、HEIC変換）
│   ├── aiExtractor.ts     # AI情報抽出（OpenAI API）
│   ├── csvProcessor.ts    # CSV処理
│   ├── outputToSheet.ts   # スプレッドシート出力
│   ├── prompt.ts          # AIプロンプト管理
│   ├── sort.ts            # データソート機能
│   ├── reset.ts           # データリセット機能
│   ├── env.ts             # 環境変数管理
│   └── types.ts           # 型定義
├── dist/                  # ビルド済みファイル
├── package.json
├── esbuild.config.js      # ビルド設定
└── appsscript.json        # GAS設定
```

## 必要な環境変数（スクリプトプロパティ）

### 開発環境用
- `MODE`: "dev" に設定
- `OCR_FOLDER_ID`: 処理対象ファイルを格納するGoogleドライブフォルダID
- `DONE_OCR_FOLDER_ID`: 処理済みファイル格納フォルダID
- `ERROR_OCR_FOLDER_ID`: エラーファイル格納フォルダID
- `CLOUD_VISION_API_KEY`: Google Cloud Vision APIキー
- `OPEN_AI_API_KEY`: OpenAI APIキー
- `OPEN_AI_MODEL`: 使用するOpenAIモデル（デフォルト: gpt-4o）
- `FREE_CONVERT_API_KEY`: FreeConvert APIキー（HEIC変換用）

### 本番環境用
各環境変数の末尾に `_PROD` を付けた名前で設定
（例: `OCR_FOLDER_ID_PROD`, `OPEN_AI_API_KEY_PROD` など）

## 処理フロー

1. **ファイル取得**: 指定フォルダから処理対象ファイルを取得
2. **形式判定**:
   - CSV → CSV処理へ
   - 画像 → OCR処理へ（HEIC形式は自動変換）
3. **情報抽出**:
   - OCRテキストからAIが必要情報を抽出
   - CSVから直接データ読み込み
4. **データ整形**:
   - 日付フォーマット統一
   - クレジットカード明細の引き落とし日を自動設定
5. **スプレッドシート出力**:
   - 日付順にソート
   - 軽減税率対象品は税率別に分割表示
6. **ファイル整理**: 処理済み/エラーファイルを適切なフォルダへ移動

## トリガー設定
- 実行する関数：`main`
- 実行するデプロイ：HEAD
- イベントのソース：時間主導型
- イベントの種類：日付ベース（毎日実行）または時間ベース（定期実行）

## 使用方法

### GASエディタから実行

1. **main()**: メイン処理を実行（全ファイル処理）
2. **debugSingleFile()**: 単一ファイルのデバッグ実行
3. **sort()**: スプレッドシートのデータを日付順にソート
4. **reset()**: スプレッドシートの全データをクリア

### 自動実行

GASのトリガー機能を使用して定期実行も可能です。

## 環境
### 本番環境
- [Spreadsheets](https://docs.google.com/spreadsheets/d/1d-rkkDYrKmYBfSdbbvEBI8WfnG2DGq-iGyJFHS4jYek/edit?gid=0#gid=0)
- [Google Apps Script](※GASプロジェクトURLを記載)

### 検証環境
- [Spreadsheets](※検証用スプレッドシートURLを記載)
- [Google Apps Script](※検証用GASプロジェクトURLを記載)

## 検証方法

1. **単一ファイルテスト**
   - `OCR_FOLDER_ID` にテスト用画像/CSVを配置
   - `debugSingleFile()` を実行
   - コンソールログで処理結果を確認

2. **バッチ処理テスト**
   - 複数のテストファイルを配置
   - `main()` を実行
   - 処理結果とフォルダ振り分けを確認

3. **エラーケーステスト**
   - 不正な画像、空のCSVなどを配置
   - エラーフォルダへの振り分けを確認

## 技術スタック

- **言語**: TypeScript
- **実行環境**: Google Apps Script
- **ビルドツール**: esbuild
- **外部API**:
  - Google Cloud Vision API（OCR）
  - OpenAI API（情報抽出）
  - FreeConvert API（画像形式変換）

## 特徴

- **デバッグモード**: 詳細なログ出力でトラブルシューティング支援
- **エラーハンドリング**: OCRエラー、AI抽出エラーを分離して集計
- **UI対応**: 実行環境に応じてアラート表示/コンソール出力を自動切り替え
- **バッチ処理**: 複数ファイルを効率的に一括処理
- **データクリーニング**: 重複除去、金額0の行を自動フィルタリング

## 開発
開発手順については、[こちら](/README.md)を参照

## 注意事項

- 処理対象ファイルは自動的に削除（ゴミ箱へ移動）されます
- エラーファイルは `ERROR_OCR_FOLDER` に保存されるので手動確認が必要です
- API利用料金が発生する場合があります（Vision API、OpenAI API）
