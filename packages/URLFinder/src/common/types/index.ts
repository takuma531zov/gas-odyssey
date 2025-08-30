/**
 * URLFinder共通インターフェース定義
 */

// ===============================================================================
// Main Result Types
// ===============================================================================

/**
 * 問い合わせページ検索結果
 */
export interface ContactPageResult {
  contactUrl: string | null;
  actualFormUrl: string | null;
  foundKeywords: string[];
  searchMethod: string;
}

/**
 * 検索戦略の戻り値
 */
export type StrategyResult = {
  result: ContactPageResult | null;
  newState: SearchStateData;
};

// ===============================================================================
// State Management Types
// ===============================================================================

/**
 * 検索状態全体のデータ構造
 */
export type SearchStateData = {
  candidatePages: Array<CandidatePage>;
  validUrls: Array<ValidUrlInfo>;
  successfulFormUrls: Array<string>;
  sameHtmlCache: { [url: string]: string };
};

/**
 * 候補ページ情報
 */
export interface CandidatePage {
  url: string;
  reason: string;
  score: number;
  structuredForms: number;
  legacyScore: number;
}

/**
 * 有効URL情報（フォールバック用）
 */
export interface ValidUrlInfo {
  url: string;
  pattern: string;
}


// ===============================================================================
// HTML Analysis & Form Extraction Types
// ===============================================================================

/**
 * フォーム検出結果
 */
export interface FormDetectionResult {
  found: boolean;
  formUrl?: string;
  formType: 'html' | 'google_forms' | 'recaptcha' | 'embedded';
  confidence: number;
}

/**
 * HTML検索結果
 */
export interface HtmlSearchResult {
  url: string | null;
  keywords: string[];
  score: number;
  context: 'navigation' | 'footer' | 'sidebar' | 'mobile_menu' | 'general';
  reasons: string[];
  linkText: string;
}

/**
 * フォーム分析結果 (汎用)
 */
export interface FormAnalysisResult {
  isValidForm: boolean;
  score: number;
  reasons: string[];
  structuredForms: number;
}

/**
 * フォーム分析結果 (Extractor内部用)
 */
export type ExtractorFormAnalysisResult = {
  isValidForm: boolean;
  reasons: string[];
  keywords: string[];
};

/**
 * 構造化フォーム分析結果
 */
export type StructuredFormResult = {
  formCount: number;
  totalFields: number;
  hasContactFields: boolean;
};

/**
 * Google Forms検出結果 (汎用)
 */
export interface GoogleFormDetectionResult {
  found: boolean;
  url?: string;
}

/**
 * Google Forms検出結果 (Extractor内部用)
 */
export type ExtractorGoogleFormResult = {
  found: boolean;
  url: string | null;
  type: string;
};

/**
 * フォーム除外判定結果
 */
export type FormExclusionResult = {
  shouldExclude: boolean;
  reason: string;
  priority: string;
};


// ===============================================================================
// Keyword & Content Analysis Types
// ===============================================================================

/**
 * キーワード検出結果
 */
export interface KeywordDetectionResult {
  matchCount: number;
  foundKeywords: string[];
}

/**
 * 連絡先情報検出結果
 */
export interface ContactInfoResult {
  hasPhone: boolean;
  hasEmail: boolean;
  hasFormMention: boolean;
  score: number;
}

/**
 * 純度計算結果
 */
export interface PurityResult {
  score: number;
  reasons: string[];
}


// ===============================================================================
// URL & Network Types
// ===============================================================================

/**
 * URL解決結果
 */
export interface UrlResolutionResult {
  resolvedUrl: string;
  isValid: boolean;
  error?: string;
}

// ===============================================================================
// State Internal Helper Types
// ===============================================================================

/**
 * 候補スコア計算用
 */
export type CandidateAnalysis = {
  formCount: number;
  totalFields: number;
  hasContactFields: boolean;
};

/**
 * フォーム要素分析用
 */
export type FormAnalysisInternal = {
  isValidForm: boolean;
  score: number;
  reasons: string[];
};
