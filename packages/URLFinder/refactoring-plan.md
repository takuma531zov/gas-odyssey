# URLFinder リファクタリング計画書

## 目的
現在のindex.ts（2633行）から関数を抽出し、純粋なエントリーポイントにリファクタリングする。
**重要**: 既存ロジックを完全に保持し、一切の機能変更を行わない。

## 現在の状況分析

### index.ts 構成（2633行）
```
├── imports (line 1-7)
├── ContactPageFinderクラス (line 28-2199) ※約2170行
└── 関数群 (line 2200-2633) ※約430行
    ├── findContactPage()           - メインAPI関数
    ├── processContactPageFinder()  - バッチ処理メイン
    ├── executeUrlFinderWithUI()    - UI処理メイン
    ├── executeSelectedMode()       - UI処理分岐
    ├── executeNormalProcessing()   - 通常処理実行
    ├── executeCheckedRowsProcessing() - チェック行処理
    ├── getUrlFromRow()             - スプレッドシート読み取り
    ├── writeResultToSheet()        - スプレッドシート書き込み
    ├── test()                      - テスト関数
    └── その他ヘルパー関数
```

### 既存ディレクトリ構造
```
src/
├── index.ts                    (2633行 - 巨大ファイル)
├── ContactPageFinder.ts        (戦略パターン版 - 未使用)
├── core/
│   ├── SearchState.ts
│   └── Step1Searcher.ts
├── strategies/                 (戦略パターン - 未使用)
├── detectors/
├── utils/
├── types/
└── ui/
    └── SpreadsheetUI.ts        (一部のUI関数のみ)
```

## リファクタリング戦略

### Phase 1: ContactPageFinderクラス抽出
**目標**: index.ts内の巨大ContactPageFinderクラスを独立ファイルに移行

#### 1.1 新しいContactPageFinderクラス作成
```bash
# 作成先: /core/ContactPageFinderLegacy.ts
# 理由: 既存の戦略パターン版と区別するためLegacy suffix
```

#### 1.2 実行手順
1. **index.ts line 28-2199を完全コピー**
2. **必要なimport文を追加**
   ```typescript
   import { Environment } from '../env';
   import type { ContactPageResult } from '../types/interfaces';
   import { StringUtils } from '../utils/StringUtils';
   import { FormUtils } from '../utils/FormUtils';
   import { NetworkUtils } from '../utils/NetworkUtils';
   import { SearchState } from './SearchState';
   ```
3. **index.tsからクラス定義削除**
4. **index.tsに新しいimport追加**
   ```typescript
   import { ContactPageFinder } from './core/ContactPageFinderLegacy';
   ```

### Phase 2: 関数群の分類・抽出

#### 2.1 メインAPI（保持）
**場所**: index.tsに残す（ラッパー関数として）
```typescript
// メインAPI - GASから直接呼び出される
function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}
```

#### 2.2 バッチ処理層
**作成先**: `/services/BatchProcessor.ts`
**移行対象**:
- `processContactPageFinder()` - メイン処理
- 関連ヘルパー関数

```typescript
export class BatchProcessor {
  static processContactPageFinder(): void {
    // 現在のprocessContactPageFinder()の内容をそのまま移行
  }
  
  // 関連ヘルパー関数も移行
}
```

#### 2.3 UI処理層
**作成先**: `/ui/SpreadsheetUILegacy.ts`
**移行対象**:
- `executeUrlFinderWithUI()` - UIメイン
- `executeSelectedMode()` - モード分岐
- `executeNormalProcessing()` - 通常処理
- `executeCheckedRowsProcessing()` - チェック処理

```typescript
export class SpreadsheetUILegacy {
  static executeUrlFinderWithUI(): void {
    // 現在の関数内容をそのまま移行
  }
  
  static executeSelectedMode(mode: string): void {
    // 現在の関数内容をそのまま移行
  }
  
  // その他UI関数も移行
}
```

#### 2.4 ユーティリティ層
**作成先**: `/utils/SpreadsheetUtils.ts`
**移行対象**:
- `getUrlFromRow()` - データ読み取り
- `writeResultToSheet()` - データ書き込み
- その他スプレッドシート関連関数

```typescript
export class SpreadsheetUtils {
  static getUrlFromRow(rowNumber: number): string {
    // 現在の関数内容をそのまま移行
  }
  
  static writeResultToSheet(rowNumber: number, result: ContactPageResult): void {
    // 現在の関数内容をそのまま移行
  }
  
  // その他関連関数も移行
}
```

#### 2.5 テスト・デバッグ層
**作成先**: `/debug/TestFunctions.ts`
**移行対象**:
- `test()` - テスト関数

### Phase 3: 最終index.ts（純粋エントリーポイント）

#### 3.1 目標構造
```typescript
/**
 * URLFinder - Pure Entry Point
 * GAS環境からの直接呼び出し専用
 */

// Core API
import { ContactPageFinder } from './core/ContactPageFinderLegacy';

// Services  
import { BatchProcessor } from './services/BatchProcessor';

// UI
import { SpreadsheetUILegacy } from './ui/SpreadsheetUILegacy';

// Debug
import { TestFunctions } from './debug/TestFunctions';

// === GAS Entry Points ===

/**
 * メインAPI - 単一URL検索
 */
function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

/**
 * バッチ処理 - スプレッドシート一括処理
 */
function processContactPageFinder(): void {
  return BatchProcessor.processContactPageFinder();
}

/**
 * UI処理 - ダイアログ表示・ユーザー操作
 */
function executeUrlFinderWithUI(): void {
  return SpreadsheetUILegacy.executeUrlFinderWithUI();
}

/**
 * テスト関数
 */
function test(): void {
  return TestFunctions.test();
}
```

#### 3.2 最終ファイル構造
```
src/
├── index.ts                    (約50行 - 純粋エントリーポイント)
├── core/
│   ├── ContactPageFinderLegacy.ts  (約2170行 - メインロジック)
│   ├── SearchState.ts
│   └── Step1Searcher.ts
├── services/
│   └── BatchProcessor.ts       (バッチ処理)
├── ui/
│   └── SpreadsheetUILegacy.ts  (UI処理)
├── utils/
│   ├── SpreadsheetUtils.ts     (スプレッドシート操作)
│   └── [existing utils]
├── debug/
│   └── TestFunctions.ts        (テスト・デバッグ)
└── [existing directories]
```

## 実行順序

### Step 1: ContactPageFinderクラス抽出
1. `/core/ContactPageFinderLegacy.ts` 作成
2. index.ts line 28-2199 をコピー
3. 必要なimport追加
4. index.tsからクラス削除
5. index.tsに新import追加
6. **動作確認**

### Step 2: 関数群抽出（段階的）
1. `/services/BatchProcessor.ts` 作成・移行
2. `/ui/SpreadsheetUILegacy.ts` 作成・移行  
3. `/utils/SpreadsheetUtils.ts` 作成・移行
4. `/debug/TestFunctions.ts` 作成・移行
5. 各段階で**動作確認**

### Step 3: 最終index.ts作成
1. 新しいindex.ts構造作成
2. 全関数のexport確認
3. **最終動作確認**

## 安全性確保

### 1. ロジック完全保持
- **一切の機能変更なし**
- **関数内容の完全コピー**
- **変数名・型・処理フローの維持**

### 2. 段階的実行
- **各段階での動作確認必須**
- **問題発生時の即座rollback**

### 3. テスト確認
- **各段階でtest()関数実行**
- **実際のGAS環境での動作確認**

## 期待効果

### 1. 保守性向上
- **ファイルサイズ削減**: 2633行 → 50行（index.ts）
- **責務分離**: 各機能が適切な場所に配置
- **可読性向上**: 構造が明確化

### 2. 開発効率向上
- **モジュール独立編集**: 関連機能のみフォーカス可能
- **テスタビリティ**: 各モジュールの独立テスト
- **再利用性**: 各モジュールの独立利用

### 3. 将来拡張性
- **新機能追加の容易性**: 適切な場所への追加
- **レガシー機能の段階的置き換え**: 戦略パターン版への移行準備

---

**重要**: このリファクタリングは既存機能の完全保持を最優先とし、一切の動作変更を行わない。