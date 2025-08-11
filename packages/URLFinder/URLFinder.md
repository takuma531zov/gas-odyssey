# URLFinder リファクタリング計画書

## 概要
ContactPageFinderの保守性・拡張性・テスタビリティ向上を目的とした包括的リファクタリング計画

## 現状分析

### コード規模
- **総行数**: 約2,500行の単一クラス
- **関数数**: 50+ (うち未使用関数15+)
- **複雑度**: 高（単一責務原則違反）

### 特定された問題

#### 1. 完全未使用関数（削除対象）
```typescript
// 完全に呼び出されていない関数
- searchInFooter()          // HTML検索系未使用
- searchInSidebar()         // HTML検索系未使用  
- searchInMobileMenu()      // HTML検索系未使用
- fallbackWithCandidates()  // 古いフォールバック（新実装で代替済み）
- evaluateValidUrls()       // 古いStep2ロジック残骸
- hasValidContactPattern()  // 未使用判定関数
- calculateDynamicSiteKeywordScore() // 未完了機能
- guessCommonContactUrls()  // 未使用推測関数
```

#### 2. 処理重複箇所
```typescript
// HTML解析系重複
- searchInNavigation() vs searchInFooter/Sidebar/MobileMenu()
  → 同一パターン: HTML抽出 → リンク検索 → キーワードマッチング

// フォーム検証系重複  
- isValidContactForm() (Step1) vs findEmbeddedHTMLForm() (Step2)
  → 類似処理: フォーム検出 → 送信ボタン確認 → フィールド検証

// URL処理重複
- 各所でのbaseUrl正規化処理
- extractDomain()とその他での重複処理

// キーワード検証重複
- calculateContactPurity()
- extractAllLinksWithKeywords()内の処理
- 各search関数内の個別実装
```

#### 3. 設定値の散在
```typescript
// スクリプトプロパティの直接参照
- getMaxTotalTime()内でPropertiesService直接呼び出し
- タイムアウト値、閾値等の設定が複数箇所に散在
```

## リファクタリング戦略

### Phase 1: クリーンアップ（最優先・最安全）
**目的**: 不要コード除去による複雑さ軽減
**影響**: ゼロ（未使用コードのため）

#### 1.1 未使用関数の完全削除
```typescript
// 削除対象（約500行削減）
✅ searchInFooter()
✅ searchInSidebar() 
✅ searchInMobileMenu()
✅ fallbackWithCandidates()
✅ evaluateValidUrls()
✅ hasValidContactPattern()
✅ calculateDynamicSiteKeywordScore()
✅ guessCommonContactUrls()
```

#### 1.2 テスト関数の整理
```typescript
// 変更前
function main() { /* テスト用だが名前が不適切 */ }

// 変更後  
function test() { 
  const testUrl = 'https://example.com'; // 任意URL設定
  const result = ContactPageFinder.findContactPage(testUrl);
  console.log(result);
}
```

### Phase 2: 設定管理の統一
**目的**: 設定値の中央集約と環境依存性の排除

#### 2.1 env.ts作成
```typescript
// src/env.ts
export class Environment {
  
  /**
   * スクリプトプロパティから設定値を取得
   * デフォルト値は設定せず、プロパティ未設定時はエラーとして扱う
   */
  static getMaxTotalTime(): number {
    const properties = PropertiesService.getScriptProperties();
    const maxTimeStr = properties.getProperty('MAX_TOTAL_TIME');
    if (!maxTimeStr || isNaN(parseInt(maxTimeStr))) {
      throw new Error('MAX_TOTAL_TIME プロパティが設定されていません');
    }
    return parseInt(maxTimeStr);
  }
  
  static getFetchTimeout(): number {
    const properties = PropertiesService.getScriptProperties();
    const timeoutStr = properties.getProperty('FETCH_TIMEOUT');
    if (!timeoutStr || isNaN(parseInt(timeoutStr))) {
      throw new Error('FETCH_TIMEOUT プロパティが設定されていません');
    }
    return parseInt(timeoutStr);
  }
  
  static getHighConfidenceThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('HIGH_CONFIDENCE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      throw new Error('HIGH_CONFIDENCE_THRESHOLD プロパティが設定されていません');
    }
    return parseInt(thresholdStr);
  }
  
  static getMediumConfidenceThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('MEDIUM_CONFIDENCE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      throw new Error('MEDIUM_CONFIDENCE_THRESHOLD プロパティが設定されていません');
    }
    return parseInt(thresholdStr);
  }
  
  static getMinimumAcceptableThreshold(): number {
    const properties = PropertiesService.getScriptProperties();
    const thresholdStr = properties.getProperty('MINIMUM_ACCEPTABLE_THRESHOLD');
    if (!thresholdStr || isNaN(parseInt(thresholdStr))) {
      throw new Error('MINIMUM_ACCEPTABLE_THRESHOLD プロパティが設定されていません');
    }
    return parseInt(thresholdStr);
  }
```

### Phase 3: ファイル分割によるモジュール化
**目的**: 責務別分離による保守性向上

#### 3.1 ディレクトリ構造
```
src/
├── ContactPageFinder.ts      // メインオーケストレーター
├── env.ts                   // 設定管理
├── test.ts                  // テスト用関数
├── strategies/              // 検索戦略
│   ├── UrlPatternStrategy.ts    // Step1: URLパターン推測
│   ├── HtmlAnalysisStrategy.ts  // Step2: HTML解析
│   └── FallbackStrategy.ts      // 最終フォールバック
├── detectors/               // 検出器
│   ├── FormDetector.ts          // フォーム検証統合
│   ├── HtmlSearcher.ts          // HTML検索統合
│   └── KeywordMatcher.ts        // キーワード処理統合
├── utils/                   // ユーティリティ
│   ├── UrlUtils.ts              // URL処理
│   ├── HtmlUtils.ts             // HTML解析
│   └── NetworkUtils.ts          // HTTP通信
└── types/                   // 型定義
    └── interfaces.ts            // 共通インターフェース
```

#### 3.2 責務別クラス設計

##### 3.2.1 メインオーケストレーター
```typescript
// ContactPageFinder.ts
/**
 * 問い合わせページ検索のメインクラス
 * 役割: 各戦略の順次実行とフォールバック管理
 */
export class ContactPageFinder {
  private static strategies: SearchStrategy[] = [
    new UrlPatternStrategy(),    // Step1
    new HtmlAnalysisStrategy(),  // Step2  
    new FallbackStrategy()       // 最終フォールバック
  ];

  /**
   * 問い合わせページ検索の実行
   * 既存APIとの完全互換性を維持
   */
  static findContactPage(baseUrl: string): ContactPageResult {
    // 各戦略を順次実行
    // 既存ロジックを完全保持
  }
}
```

##### 3.2.2 検索戦略インターフェース
```typescript
// types/interfaces.ts
/**
 * 検索戦略の共通インターフェース
 */
interface SearchStrategy {
  /**
   * 検索実行
   * @param baseUrl 対象URL
   * @returns 検索結果（null=失敗、結果=成功）
   */
  search(baseUrl: string): ContactPageResult | null;
  
  /**
   * 戦略名（デバッグ用）
   */
  getStrategyName(): string;
}

/**
 * フォーム検出結果
 */
interface FormDetectionResult {
  found: boolean;
  formUrl?: string;
  formType: 'html' | 'google_forms' | 'recaptcha' | 'embedded';
  confidence: number;
}

/**
 * HTML検索結果
 */
interface HtmlSearchResult {
  url: string | null;
  keywords: string[];
  score: number;
  context: 'navigation' | 'footer' | 'sidebar' | 'mobile_menu';
}
```

##### 3.2.3 Step1専用クラス
```typescript
// strategies/UrlPatternStrategy.ts
/**
 * Step1: URLパターン推測による高速検索
 * 目的: 一般的な問い合わせページパターンを優先順位付きでテスト
 * 対象: /contact/, /inquiry/, /form/ 等の定型パターン
 */
export class UrlPatternStrategy implements SearchStrategy {
  
  /**
   * 優先順位付きURLパターンテスト
   * SPA検出と統合されたロジック
   */
  search(baseUrl: string): ContactPageResult | null {
    // 既存のsearchWithPriorityPatterns()ロジックを移動
    // SPA検出、アンカー分析機能を含む
  }
  
  /**
   * 構造化フォーム検証
   * 条件: <form>要素 + 送信ボタン + contact関連フィールド
   */
  private validateStructuredForm(html: string): boolean {
    // 既存のisValidContactForm()ロジック
  }
}
```

##### 3.2.4 Step2専用クラス  
```typescript
// strategies/HtmlAnalysisStrategy.ts
/**
 * Step2: ホームページHTML解析によるフォールバック検索
 * 目的: Step1失敗時のNavigation/Footer解析
 * 対象: Navigation内のcontactリンク検出
 */
export class HtmlAnalysisStrategy implements SearchStrategy {
  
  search(baseUrl: string): ContactPageResult | null {
    // 既存のanalyzeHtmlContent()ロジック
    // アンカーリンク特別処理含む
  }
  
  /**
   * ナビゲーション検索
   * 唯一使用されているHTML検索処理
   */
  private searchInNavigation(html: string, baseUrl: string): HtmlSearchResult {
    // 既存ロジック保持
  }
}
```

##### 3.2.5 統合検出器
```typescript
// detectors/FormDetector.ts
/**
 * フォーム検出の統合クラス
 * Step1とStep2のフォーム検証ロジックを統一
 */
export class FormDetector {
  
  /**
   * 任意のフォーム検出（HTML/Google Forms/reCAPTCHA）
   */
  static detectAnyForm(html: string): FormDetectionResult {
    // 既存の複数検証ロジックを統合
  }
  
  /**
   * HTMLフォーム検証（構造化フォーム）
   */
  private static detectHtmlForm(html: string): boolean {
    // isValidContactForm()ロジック
  }
  
  /**
   * Google Forms検証
   */
  private static detectGoogleForms(html: string): { found: boolean, url?: string } {
    // 既存ロジック
  }
  
  /**
   * reCAPTCHA検証（JavaScript動的フォーム）
   */
  private static detectRecaptchaForm(html: string): boolean {
    // hasScriptAndRecaptcha()ロジック
  }
}
```

### Phase 4: コメント・ドキュメント強化
**目的**: 可読性とメンテナンス性の向上

#### 4.1 日本語コメント規約
```typescript
/**
 * 機能概要（日本語）
 * 
 * @param parameter パラメータ説明（日本語）
 * @returns 戻り値説明（日本語）
 * 
 * 実装注意事項:
 * - 既存ロジック保持のポイント
 * - BtoB営業での用途
 * - パフォーマンス考慮事項
 */
```

#### 4.2 処理フロー図解コメント
```typescript
/**
 * Step1フロー:
 * 1. ドメイン生存確認
 * 2. 優先URLパターンテスト (/contact/ → /contact → /inquiry/ ...)  
 * 3. SPA検出（同一HTML判定）
 * 4. 構造化フォーム検証
 * 5. Google Forms検証
 * 6. アンカー分析（SPA対応）
 */
```

## 移行計画・実行手順

### Step A: 安全なクリーンアップ
1. **未使用関数削除** → テスト実行 → 動作確認
2. **test()関数作成** → main()削除  
3. **env.ts作成** → 設定値移行

### Step B: ファイル分割準備
1. **interfaces.ts作成** → 型定義統一
2. **utils/配下作成** → 純粋関数分離
3. **各ファイルでのテスト実行**

### Step C: 戦略クラス分離
1. **UrlPatternStrategy分離** → Step1独立化
2. **HtmlAnalysisStrategy分離** → Step2独立化  
3. **メインクラス簡素化** → オーケストレーション特化

### Step D: 最終統合テスト
1. **既存成功ケース確認** (icentertainment.jp, cybercartel.net)
2. **新機能動作確認** (SPA対応、最終フォールバック)
3. **エラーハンドリング確認**

## リスク軽減策

### 1. 段階的実行
- 1つのPhaseずつ実行
- 各段階でのテスト実行必須
- 既存API互換性の継続確認

### 2. 回帰テストケース
```typescript
// 必須テストケース
const testCases = [
  'https://icentertainment.jp/',      // Step2成功パターン
  'http://www.cybercartel.net/',      // SPA対応パターン  
  'https://kaizenplatform.com/',      // 最終フォールバックパターン
];
```

### 3. 緊急時の復旧手順
- 各Phaseでのgitコミット必須
- 問題発生時の即座なrollback手順
- 分割前コードのバックアップ保持

## 期待される効果

### 定量的改善
- **コード行数**: 2,500行 → 1,800行 (約30%削減)
- **ファイル数**: 1個 → 12個 (責務分離)
- **関数数**: 50+ → 35前後 (重複排除)

### 定性的改善  
- **保守性**: 機能別ファイル分割により修正範囲限定
- **テスタビリティ**: 各戦略の独立テスト可能
- **拡張性**: 新戦略追加時の影響範囲最小化
- **可読性**: 日本語コメント + 責務明確化

### 既存機能保証
- **API互換性**: `ContactPageFinder.findContactPage()`完全保持
- **出力結果**: 一切の変更なし
- **パフォーマンス**: 不要コード削除により向上
- **BtoB営業価値**: 機能向上（最終フォールバック等）

---

## 実行承認確認

この計画に基づいてリファクタリングを開始してよろしいでしょうか？  
特に **Phase 1: クリーンアップ** から段階的に進める予定です。