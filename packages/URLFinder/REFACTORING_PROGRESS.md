# URLFinder リファクタリング進捗 - 44ac0de最適版からの安全分離

## 基本方針
**44ac0de最適版の完璧なロジックを1バイトも変更せずに関数分離**
- 元コミット: `44ac0de` (2995行monolithic index.ts - 最適版)
- 参照資料: `OPTIMAL_ARCHITECTURE_ANALYSIS.md` (分析・依存関係・安全度)
- 作業ブランチ: `urlFinder-44ac0de` (44ac0de状態から新規作成)

## 分離戦略 - 5 Phase安全アプローチ

### Phase 1: 🟢 最安全関数 (依存なし・単純ユーティリティ) [完了✅]
```
✅ toHexString() → utils/StringUtils.ts
✅ isValidEncoding() → utils/StringUtils.ts  
✅ hashString() → utils/StringUtils.ts
✅ isAnchorLink() → utils/StringUtils.ts
✅ containsSubmitKeyword() + SUBMIT_BUTTON_KEYWORDS → utils/FormUtils.ts
✅ getDetailedErrorMessage() → utils/NetworkUtils.ts
```
**実施日**: 2025-08-23  
**結果**: 全6関数抽出完了、ビルドエラーなし、ロジック保持確認済み

### Phase 2: 🟡 中安全関数 (1-2個の単純依存) [次の作業]
```
- isSNSPage()
- extractDomain()  
- isHomepageUrl()
- hasScriptAndRecaptcha()
- evaluateFallbackUrlQuality()
```

### Phase 3: 🟠 注意必要関数 (複数依存・状態変更)
```
- getContentWithEncoding()
- checkDomainAvailability() 
- hasSubmitButtonInForm()
- logPotentialCandidate()
- calculateCandidateScore()
```

### Phase 4: GAS関数群 → processors/
```
- test()
- executeUrlFinderWithUI()
- executeSelectedMode()  
- (SpreadsheetProcessor関連)
```

### Phase 5: 🔴 高リスク関数 (最後に検討)
```
- detectSameHtmlPattern() + sameHtmlCache操作
- isValidContactPage()
- isValidContactForm() 
- analyzeFormElements()
- calculateContactPurity()
- 全ての検索・解析メソッド (Step1/Step2コア処理)
```

## 作業ルール（厳守）

### ✅ 絶対遵守事項
1. **1関数ずつ移動** - 複数同時禁止
2. **各段階でビルド確認** - npm run build必須
3. **依存関係の完全マッピング** - 事前確認
4. **ロジック変更絶対禁止** - 1バイトも変更しない
5. **OPTIMAL_ARCHITECTURE_ANALYSIS.md常時参照**

### 🚨 変更禁止エリア
- 状態管理構造 (candidatePages, validUrls, successfulFormUrls)
- メインフローの順序 (Step1 → Step2 → Final)
- キーワード配列の内容・順序
- スコア計算ロジック
- SPA検出の仕組み

### 📁 目標モジュール構成
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
│   ├── NetworkUtils.ts (HTTP・URL処理) [進行中]
│   ├── StringUtils.ts (文字列処理) [進行中] 
│   ├── FormUtils.ts (フォーム処理) [進行中]
│   └── EncodingUtils.ts (文字エンコーディング)
├── processors/
│   └── SpreadsheetProcessor.ts (GAS機能)
├── constants/
│   └── Keywords.ts (定数群)
├── env.ts
└── types/interfaces.ts
```

## Phase 2 作業計画 (次回)

### 対象関数: 🟡中安全関数5つ
1. `isSNSPage()` → utils/NetworkUtils.ts
2. `extractDomain()` → utils/NetworkUtils.ts  
3. `isHomepageUrl()` → utils/NetworkUtils.ts
4. `hasScriptAndRecaptcha()` → utils/FormUtils.ts
5. `evaluateFallbackUrlQuality()` → core/CandidateManager.ts

### 作業手順
1. 各関数の依存関係確認
2. 1つずつ抽出・テスト・確認
3. ビルド成功後に次の関数へ
4. Phase 2完了後にPhase 3計画更新

## 成功基準
- ✅ ビルドエラーなし
- ✅ 既存テスト通過  
- ✅ ログ出力完全一致
- ✅ 処理時間・メモリ使用量変化なし

---
**最終更新**: 2025-08-23  
**最終コミット**: urlFinder-44ac0de branch  
**次回作業**: Phase 2 - 🟡中安全関数の抽出開始