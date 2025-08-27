/**
 * 検索状態管理純粋関数群
 * SearchState の関数型実装
 */

import type { ContactPageResult } from '../data/types/interfaces';
import { evaluateFallbackUrlQuality } from '../functions/network/fetch';

// 型定義
export type SearchStateData = {
  candidatePages: Array<{
    url: string;
    reason: string;
    score: number;
    structuredForms: number;
    legacyScore: number;
  }>;
  validUrls: Array<{ 
    url: string;
    pattern: string;
  }>;
  successfulFormUrls: Array<string>;
  sameHtmlCache: { [url: string]: string };
};

export type CandidateAnalysis = {
  formCount: number;
  totalFields: number;
  hasContactFields: boolean;
};

export type FormAnalysisInternal = {
  isValidForm: boolean;
  score: number;
  reasons: string[];
};

// 純粋関数群

/**
 * 空の検索状態を生成（純粋関数）
 */
export const createEmptyState = (): SearchStateData => ({
  candidatePages: [],
  validUrls: [],
  successfulFormUrls: [],
  sameHtmlCache: {}
});

/**
 * 候補ページを追加（純粋関数）
 */
export const addCandidate = (
  state: SearchStateData,
  url: string,
  reason: string,
  html: string
): SearchStateData => {
  console.log(`Recording potential candidate: ${url} (reason: ${reason})`);
  
  const structuredAnalysis = analyzeStructuredForms(html);
  const formAnalysis = analyzeFormElements(html);
  const score = calculateCandidateScore(url, reason, structuredAnalysis, formAnalysis);

  const newCandidate = {
    url,
    reason,
    score,
    structuredForms: structuredAnalysis.formCount,
    legacyScore: formAnalysis.score
  };

  console.log(`Candidate added: score=${score}, structured forms=${structuredAnalysis.formCount}`);
  
  return {
    ...state,
    candidatePages: [...state.candidatePages, newCandidate]
  };
};

/**
 * 有効URLを追加（純粋関数）
 */
export const addValidUrl = (
  state: SearchStateData,
  url: string,
  pattern: string
): SearchStateData => {
  console.log(`Valid URL recorded: ${url} (pattern: ${pattern})`);
  return {
    ...state,
    validUrls: [...state.validUrls, { url, pattern }]
  };
};

/**
 * 成功したフォームURLを追加（純粋関数）
 */
export const addSuccessfulFormUrl = (
  state: SearchStateData,
  url: string
): SearchStateData => {
  console.log(`Successful form URL recorded: ${url}`);
  return {
    ...state,
    successfulFormUrls: [...state.successfulFormUrls, url]
  };
};

/**
 * 成功したフォームURLの存在チェック（純粋関数）
 */
export const isSuccessfulFormUrl = (state: SearchStateData, url: string): boolean => {
  return state.successfulFormUrls.includes(url);
};

/**
 * HTMLキャッシュを設定（純粋関数）
 */
export const setHtmlCache = (
  state: SearchStateData,
  url: string,
  contentHash: string
): SearchStateData => {
  return {
    ...state,
    sameHtmlCache: { ...state.sameHtmlCache, [url]: contentHash }
  };
};

/**
 * HTMLキャッシュを取得（純粋関数）
 */
export const getHtmlCache = (state: SearchStateData, url: string): string | undefined => {
  return state.sameHtmlCache[url];
};

/**
 * 有効URLリストを取得（純粋関数）
 */
export const getValidUrls = (state: SearchStateData): Array<{ url: string; pattern: string }> => {
  return [...state.validUrls];
};

/**
 * 候補数を取得（純粋関数）
 */
export const getCandidateCount = (state: SearchStateData): number => {
  return state.candidatePages.length;
};

/**
 * 最終フォールバック結果を取得（純粋関数）
 */
export const getFinalResult = (state: SearchStateData): ContactPageResult => {
  console.log(`Checking final fallback from ${state.validUrls.length} valid URLs`);
  
  if (state.validUrls.length === 0) {
    console.log('No valid URLs available for final fallback');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'no_valid_urls'
    };
  }

  // 高優先度contactパターンを優先的に探す
  const contactPriorityPatterns = [
    '/contact/', '/contact', '/inquiry/', '/inquiry', 
    '/form/', '/form'
  ];

  // 高優先度contact patternを探す
  for (const priorityPattern of contactPriorityPatterns) {
    const matchingUrl = state.validUrls.find(urlInfo => 
      urlInfo.pattern === priorityPattern
    );
    
    if (matchingUrl) {
      console.log(`Priority contact pattern found: ${matchingUrl.url} (${priorityPattern})`);
      const qualityScore = evaluateFallbackUrlQuality(matchingUrl.url, matchingUrl.pattern);
      
      return {
        contactUrl: matchingUrl.url,
        actualFormUrl: matchingUrl.url,
        foundKeywords: ['priority_fallback', priorityPattern.replace(/\//g, ''), ...qualityScore.keywords],
        searchMethod: 'priority_fallback_contact'
      };
    }
  }

  // 高優先度がない場合、最初の200 OK URLを使用
  const firstValidUrl = state.validUrls[0];
  if (!firstValidUrl) {
    console.log('No valid URLs available in array');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'no_valid_urls'
    };
  }

  console.log(`Final fallback: Using first valid URL ${firstValidUrl.url} (pattern: ${firstValidUrl.pattern})`);
  
  // URLの品質を評価
  const qualityScore = evaluateFallbackUrlQuality(firstValidUrl.url, firstValidUrl.pattern);
  
  return {
    contactUrl: firstValidUrl.url,
    actualFormUrl: firstValidUrl.url,
    foundKeywords: ['final_fallback', 'first_valid_url', firstValidUrl.pattern.replace(/\//g, ''), ...qualityScore.keywords],
    searchMethod: qualityScore.confidence >= 0.7 ? 'final_fallback_high_confidence' : 'final_fallback_low_confidence'
  };
};

// 内部ヘルパー関数

/**
 * 候補スコア計算（純粋関数）
 */
const calculateCandidateScore = (
  url: string, 
  reason: string, 
  structuredAnalysis: CandidateAnalysis,
  formAnalysis: FormAnalysisInternal
): number => {
  let score = 0;

  // Base score from form analysis
  score += formAnalysis.score;

  // Structured forms bonus
  score += structuredAnalysis.formCount * 5;
  score += structuredAnalysis.totalFields * 2;

  if (structuredAnalysis.hasContactFields) {
    score += 10;
  }

  // URL pattern bonus
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/contact')) score += 15;
  if (lowerUrl.includes('/inquiry')) score += 12;
  if (lowerUrl.includes('/form')) score += 8;

  // Reason-based bonus
  if (reason.includes('structured_forms')) score += 10;
  if (reason.includes('google_forms')) score += 8;

  return Math.max(0, score);
};

/**
 * 構造化フォーム分析（純粋関数）
 */
const analyzeStructuredForms = (html: string): CandidateAnalysis => {
  const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || [];
  let totalFields = 0;
  let hasContactFields = false;

  for (const form of formMatches) {
    const inputMatches = form.match(/<input[^>]*>/gi) || [];
    const textareaMatches = form.match(/<textarea[^>]*>/gi) || [];
    const selectMatches = form.match(/<select[^>]*>/gi) || [];
    
    totalFields += inputMatches.length + textareaMatches.length + selectMatches.length;

    const contactPatterns = [
      /name/i, /email/i, /phone/i, /tel/i, /message/i, /inquiry/i,
      /お名前/i, /メール/i, /電話/i, /問い合わせ/i, /メッセージ/i
    ];

    for (const pattern of contactPatterns) {
      if (pattern.test(form)) {
        hasContactFields = true;
        break;
      }
    }
  }

  return {
    formCount: formMatches.length,
    totalFields,
    hasContactFields
  };
};

/**
 * フォーム要素分析（純粋関数）
 */
const analyzeFormElements = (html: string): FormAnalysisInternal => {
  let score = 0;
  const reasons: string[] = [];

  const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gis) || [];
  if (formMatches.length > 0) {
    score += 10;
    reasons.push(`found_${formMatches.length}_forms`);
  }

  const inputMatches = html.match(/<input[^>]*>/gi) || [];
  if (inputMatches.length > 0) {
    score += Math.min(inputMatches.length * 2, 10);
    reasons.push(`found_${inputMatches.length}_inputs`);
  }

  const isValidForm = score >= 10 && formMatches.length > 0;

  return {
    isValidForm,
    score,
    reasons
  };
};

// 高階関数とコンビネータ

/**
 * 状態変換パイプライン生成（高階関数）
 */
export const createStateTransformer = <T>(...transformers: Array<(state: SearchStateData, ...args: any[]) => SearchStateData>) =>
  (initialState: SearchStateData, ...args: T[]): SearchStateData => {
    return transformers.reduce((state, transformer, index) => {
      return transformer(state, args[index]);
    }, initialState);
  };

/**
 * 条件付き状態変更（高階関数）
 */
export const createConditionalStateTransformer = <T>(
  condition: (state: SearchStateData, ...args: T[]) => boolean,
  transformer: (state: SearchStateData, ...args: T[]) => SearchStateData
) => (state: SearchStateData, ...args: T[]): SearchStateData => {
    if (condition(state, ...args)) {
      return transformer(state, ...args);
    }
    return state;
  };

/**
 * 状態フィルタ生成（高階関数）
 */
export const createStateFilter = (predicate: (item: any) => boolean) =>
  (state: SearchStateData, field: keyof SearchStateData): SearchStateData => {
    if (Array.isArray(state[field])) {
      return {
        ...state,
        [field]: (state[field] as any[]).filter(predicate)
      };
    }
    return state;
  };