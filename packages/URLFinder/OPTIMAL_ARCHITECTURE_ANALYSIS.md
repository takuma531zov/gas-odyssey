# URLFinder 最適版アーキテクチャ分析（44ac0de）

## 概要
44ac0de時点のindex.tsは**2995行の単一ファイル**に全機能が統合された**ロジック最適版**です。
この状態は長期間のテストとデバッグを経て確立された、完璧に動作する状態です。

## ファイル構造現状
```
src/
├── index.ts (2995行) - 全機能統合ファイル
├── env.ts - 環境設定
└── types/interfaces.ts - 型定義
```

## ContactPageFinderクラス内部構造

### 1. 状態管理（プライベート静的変数）
```typescript
// 候補管理システム
private static candidatePages: Array<{...}>      // Step1候補記録
private static validUrls: Array<{...}>           // 200 OK URLs（フォールバック用）
private static successfulFormUrls: Array<...>    // 重複回避用成功URL

// SPA検出用キャッシュ
private static sameHtmlCache: { [url: string]: string } = {};
```

### 2. 定数・設定（プライベート静的読み取り専用）
```typescript
// キーワードシステム
private static readonly HIGH_PRIORITY_CONTACT_KEYWORDS = [...]
private static readonly MEDIUM_PRIORITY_CONTACT_KEYWORDS = [...]
private static readonly EXCLUDED_KEYWORDS = [...]
private static readonly CONTACT_KEYWORDS = [...]

// URLパターン
private static readonly HIGH_PRIORITY_PATTERNS = [...]

// フォーム検証用
private static readonly FORM_KEYWORDS = [...]
private static readonly SUBMIT_BUTTON_KEYWORDS = [...]
```

### 3. 主要処理メソッド（機能別分類）

#### A. エントリーポイント（Public）
```typescript
static findContactPage(baseUrl: string): ContactPageResult
```
**責務**: 全体のフロー制御・エラーハンドリング

#### B. Step1: URLパターン推測
```typescript
private static searchWithPriorityPatterns(domainUrl: string, startTime: number): ContactPageResult
private static isValidContactPage(html: string): boolean
private static getDetailedErrorMessage(statusCode: number): string
```
**責務**: 高速URLパターンテスト・HTTP状態確認・ページ有効性判定

#### C. Step2: HTML解析フォールバック
```typescript
private static analyzeHtmlContent(html: string, baseUrl: string): ContactPageResult
private static searchInNavigation(html: string, baseUrl: string): {url, keywords, score, reasons}
private static extractAllContactLinks(content: string, baseUrl: string): Array<{...}>
private static extractContactLinks(content: string, baseUrl: string, contextType?: string): {url, keywords, score, reasons, linkText}
```
**責務**: ナビゲーション解析・リンク抽出・コンテキスト分析

#### D. SPA対応システム
```typescript
private static detectSameHtmlPattern(urls: string[], htmlContent: string): boolean
private static hashString(str: string): string
private static executeSPAAnalysis(html: string, baseUrl: string): ContactPageResult
private static isAnchorLink(url: string): boolean
private static analyzeAnchorSection(html: string, anchorUrl: string, baseUrl: string): ContactPageResult
private static extractContactInfo(html: string): {phone, email, contactForm}
```
**責務**: Single Page Application検出・アンカー分析・セクション内容抽出

#### E. フォーム検証システム
```typescript
private static analyzeFormElements(html: string): {isValidForm, reasons, keywords}
private static analyzeStructuredForms(html: string): {formCount, totalFields, hasContactFields}
private static isValidContactForm(html: string): boolean
private static hasScriptAndRecaptcha(html: string): boolean
private static hasSubmitButtonInForm(formHTML: string): boolean
private static containsSubmitKeyword(buttonHTML: string): boolean
private static detectGoogleForms(html: string): {found, url, type}
```
**責務**: フォーム要素解析・Google Forms検出・送信ボタン検証・JavaScript動的フォーム対応

#### F. 候補管理・スコア計算
```typescript
private static logPotentialCandidate(url: string, reason: string, html: string): void
private static calculateCandidateScore(url: string, reason: string, formAnalysis: any): number
private static calculateContactPurity(url: string, linkText: string, context?: string): {score, reasons}
```
**責務**: 候補記録・信頼度スコア算出・純度計算

#### G. Final Fallback システム
```typescript
private static getFinalFallbackUrl(): ContactPageResult
private static evaluateFallbackUrlQuality(url: string, pattern: string): {confidence, keywords}
```
**責務**: 最終フォールバック処理・URL品質評価

#### H. ネットワーク・ユーティリティ
```typescript
private static fetchWithTimeout(url: string, timeout: number): any
private static getContentWithEncoding(response: any): string
private static isValidEncoding(content: string): boolean
private static checkDomainAvailability(url: string): {available, error?}
private static isSNSPage(url: string): boolean
private static extractDomain(baseUrl: string): string
private static resolveUrl(url: string, baseUrl: string): string
private static toHexString(str: string): string
```
**責務**: HTTP通信・文字エンコーディング処理・URL操作・ドメイン確認

#### I. セカンドステージ検索
```typescript
private static findActualForm(contactPageUrl: string): string | null
private static findSecondStageFormLink(html: string, contactPageUrl: string): string | null
private static isHomepageUrl(url: string, baseUrl: string): boolean
```
**責務**: 2段階フォーム検索・実際のフォームURL発見

### 4. GAS関数群（グローバル関数）
```typescript
function findContactPage(url: string): ContactPageResult  // ラッパー
function executeUrlFinderWithUI(): void  // UI実行
function executeSelectedMode(mode: string): void  // モード実行
function processContactPageFinder(): void  // バッチ処理
// ...その他スプレッドシート操作関数群
```

## 処理フロー詳細

### メインフロー
```
findContactPage(baseUrl)
├── 初期化・候補リセット
├── SNSページ判定 → 除外
├── ドメイン生存確認
├── Step1: searchWithPriorityPatterns()
│   ├── HIGH_PRIORITY_PATTERNS ループ
│   ├── fetchWithTimeout() → HTTP通信
│   ├── detectSameHtmlPattern() → SPA検出
│   │   └── executeSPAAnalysis() → SPA処理
│   ├── isValidContactPage() → ページ有効性
│   ├── isValidContactForm() → フォーム検証
│   ├── detectGoogleForms() → Google Forms検証
│   └── logPotentialCandidate() → 候補記録
├── Step2: analyzeHtmlContent()
│   ├── searchInNavigation() → ナビ解析
│   ├── extractAllContactLinks() → リンク抽出
│   ├── calculateContactPurity() → 純度計算
│   └── 詳細フォーム検証
└── Final: getFinalFallbackUrl()
    └── evaluateFallbackUrlQuality()
```

### 依存関係マップ

#### 核となる依存関係
```
findContactPage (エントリー)
├── searchWithPriorityPatterns
│   ├── detectSameHtmlPattern → hashString
│   ├── executeSPAAnalysis → isAnchorLink, analyzeAnchorSection
│   ├── isValidContactPage
│   ├── isValidContactForm → hasSubmitButtonInForm, hasScriptAndRecaptcha
│   ├── detectGoogleForms
│   └── logPotentialCandidate → calculateCandidateScore
├── analyzeHtmlContent
│   ├── searchInNavigation → extractContactLinks, calculateContactPurity
│   ├── extractAllContactLinks → extractContactLinks
│   └── findActualForm → findSecondStageFormLink
└── getFinalFallbackUrl → evaluateFallbackUrlQuality
```

#### ユーティリティ依存関係
```
HTTP通信系:
fetchWithTimeout → getContentWithEncoding → isValidEncoding
checkDomainAvailability, isSNSPage, extractDomain

URL操作系:
resolveUrl, toHexString, isHomepageUrl

フォーム解析系:
analyzeFormElements → analyzeStructuredForms
hasSubmitButtonInForm → containsSubmitKeyword
```

## 関数分離戦略

### 安全度別分類

#### 🟢 最安全（依存なし・単純ユーティリティ）
```typescript
- toHexString()
- isValidEncoding()
- hashString()
- isAnchorLink()
- containsSubmitKeyword()
- getDetailedErrorMessage()
```

#### 🟡 中安全（1-2個の単純依存）
```typescript
- isSNSPage()
- extractDomain()
- isHomepageUrl()
- hasScriptAndRecaptcha()
- evaluateFallbackUrlQuality()
```

#### 🟠 注意必要（複数依存・状態変更）
```typescript
- getContentWithEncoding()
- checkDomainAvailability() 
- hasSubmitButtonInForm()
- logPotentialCandidate()
- calculateCandidateScore()
```

#### 🔴 高リスク（複雑依存・核心処理）
```typescript
- detectSameHtmlPattern() + sameHtmlCache操作
- isValidContactPage()
- isValidContactForm() 
- analyzeFormElements()
- calculateContactPurity()
- 全ての検索・解析メソッド
```

### 分離推奨順序

1. **Phase 1**: 🟢最安全関数 → `utils/` に移動
2. **Phase 2**: 🟡中安全関数 → 適切なモジュールに移動
3. **Phase 3**: 🟠注意必要関数 → 慎重に分離
4. **Phase 4**: GAS関数群 → `processors/` に移動
5. **Phase 5**: 🔴高リスク関数は**最後に検討**

### モジュール分離案

```
src/
├── index.ts (エントリーポイントのみ)
├── core/
│   ├── ContactPageFinder.ts (メイン処理)
│   ├── PatternSearcher.ts (Step1処理)
│   ├── HtmlAnalyzer.ts (Step2処理)
│   ├── CandidateManager.ts (候補・状態管理)
│   └── SpaAnalyzer.ts (SPA検出)
├── detectors/
│   ├── FormDetector.ts (フォーム検証)
│   └── GoogleFormsDetector.ts (Google Forms)
├── utils/
│   ├── NetworkUtils.ts (HTTP・URL処理)
│   ├── EncodingUtils.ts (文字エンコーディング)
│   └── StringUtils.ts (文字列処理)
├── processors/
│   └── SpreadsheetProcessor.ts (GAS機能)
├── constants/
│   └── Keywords.ts (定数群)
├── env.ts
└── types/interfaces.ts
```

## 重要な注意事項

### 🚨 絶対に変更してはいけない部分
1. **状態管理の構造**（candidatePages, validUrls, successfulFormUrls）
2. **メインフローの順序**（Step1 → Step2 → Final）
3. **キーワード配列の内容・順序**
4. **スコア計算ロジック**
5. **SPA検出の仕組み**

### ✅ 分離時の安全原則
1. **1関数ずつ移動**（複数同時禁止）
2. **依存関係の完全マッピング**
3. **各段階でのビルド・動作確認**
4. **元の関数は移動完了まで保持**
5. **import/export の段階的構築**

### 📝 成功基準
- ビルドエラーなし
- 既存テストの全て通過
- ログ出力の完全一致
- 処理時間の大幅変化なし
- メモリ使用量の大幅変化なし

このアーキテクチャ分析を**常に参照**しながら、安全な関数分離を実施してください。