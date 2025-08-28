/**
 * URLFinder共通インターフェース定義
 */

import type { SearchState } from '../pipelines/state';

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
 * 検索戦略の共通インターフェース
 */
export interface SearchStrategy {
  /**
   * 検索実行
   * @param baseUrl 対象URL
   * @param searchState 検索状態
   * @returns 検索結果（null=失敗、結果=成功）
   */
  search(baseUrl: string, searchState: SearchState): ContactPageResult | null;
  
  /**
   * 戦略名（デバッグ用）
   */
  getStrategyName(): string;
}

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

/**
 * キーワード検出結果
 */
export interface KeywordDetectionResult {
  matchCount: number;
  foundKeywords: string[];
}

/**
 * フォーム分析結果
 */
export interface FormAnalysisResult {
  isValidForm: boolean;
  score: number;
  reasons: string[];
  structuredForms: number;
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
 * URL解決結果
 */
export interface UrlResolutionResult {
  resolvedUrl: string;
  isValid: boolean;
  error?: string;
}

/**
 * 純度計算結果
 */
export interface PurityResult {
  score: number;
  reasons: string[];
}

/**
 * Google Forms検出結果
 */
export interface GoogleFormDetectionResult {
  found: boolean;
  url?: string;
}