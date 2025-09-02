/**
 * キーワード処理関数群
 * 高階関数とカリー化による関数型実装
 */

import type { PurityResult, KeywordDetectionResult, ContactInfoResult } from '../../../common/types/types';
import {
  HIGH_PRIORITY_CONTACT_KEYWORDS,
  CONTACT_KEYWORDS,
  PHONE_PATTERNS,
  EMAIL_PATTERN,
  NEGATIVE_PATTERNS,
  FORM_MENTION_PATTERNS,
  DYNAMIC_CONTACT_KEYWORDS,
  DYNAMIC_INDUCTION_PHRASES,
  DYNAMIC_FORM_HINTS
} from './constants';

// 高階関数型定義
type KeywordProcessor<T> = (keywords: string[]) => (input: string) => T;
type ScoreCalculator = (keyword: string, location: 'url' | 'text') => number;

/**
 * キーワードの重み値を取得（純粋関数）
 */
export const getKeywordWeight: ScoreCalculator = (keyword: string, location: 'url' | 'text'): number => {
  const baseWeight = location === 'url' ? 4 : 3;

  // 特別な重み付け
  if (keyword.includes('お問い合わせ') || keyword === 'contact') {
    return baseWeight + 2;
  }
  if (keyword.includes('フォーム') || keyword === 'form') {
    return baseWeight + 1;
  }

  return baseWeight;
};

/**
 * キーワードマッチング関数を生成（高階関数）
 */
export const createKeywordMatcher = (keywords: string[]) => (text: string): string[] =>
  keywords.filter(keyword => text.toLowerCase().includes(keyword.toLowerCase()));

/**
 * スコア計算関数を生成（高階関数）
 */
export const createScoreCalculator = (scoreCalculator: ScoreCalculator) =>
  (keywords: string[], location: 'url' | 'text') =>
    (matches: string[]): { score: number; reasons: string[] } =>
      matches.reduce(
        (acc, keyword) => {
          const points = scoreCalculator(keyword, location);
          return {
            score: acc.score + points,
            reasons: [...acc.reasons, `${location}_keyword:${keyword}(+${points})`]
          };
        },
        { score: 0, reasons: [] as string[] }
      );

/**
 * 純度計算用の合成関数
 */
const matchHighPriorityKeywords = createKeywordMatcher(HIGH_PRIORITY_CONTACT_KEYWORDS);
const calculateKeywordScore = createScoreCalculator(getKeywordWeight);

/**
 * URL・リンクテキストの問い合わせ純度計算（関数型）
 */
export const calculateContactPurity = (url: string, linkText: string, context: string = ''): PurityResult => {
  const reasons: string[] = [];
  let score = 0;

  if (!url && !linkText) {
    return { score: 0, reasons: ['empty_input'] };
  }

  const lowerUrl = (url || '').toLowerCase();
  const lowerText = (linkText || '').toLowerCase();
  const lowerContext = context.toLowerCase();

  console.log(`Calculating contact purity for: URL="${url}", Text="${linkText}", Context="${context}"`);

  // URL内の高優先度キーワードチェック（関数型）
  const urlMatches = matchHighPriorityKeywords(lowerUrl);
  const urlScore = calculateKeywordScore(HIGH_PRIORITY_CONTACT_KEYWORDS, 'url')(urlMatches);
  score += urlScore.score;
  reasons.push(...urlScore.reasons);

  // リンクテキスト内の高優先度キーワードチェック（関数型）
  const textMatches = matchHighPriorityKeywords(lowerText);
  const textScore = calculateKeywordScore(HIGH_PRIORITY_CONTACT_KEYWORDS, 'text')(textMatches);
  score += textScore.score;
  reasons.push(...textScore.reasons);

  // コンテキストボーナス（関数型）
  const contextBonus = [
    { pattern: 'nav', bonus: 3, label: 'navigation_context' },
    { pattern: 'footer', bonus: 2, label: 'footer_context' }
  ]
    .filter(({ pattern }) => lowerContext.includes(pattern))
    .reduce((acc, { bonus, label }) => {
      reasons.push(`${label}(+${bonus})`);
      return acc + bonus;
    }, 0);
  score += contextBonus;

  // URLパターンボーナス（関数型）
  const urlPatterns = [
    { pattern: '/contact', bonus: 5, label: 'contact_path_pattern' },
    { pattern: '/inquiry', bonus: 4, label: 'inquiry_path_pattern' },
    { pattern: '/form', bonus: 3, label: 'form_path_pattern' }
  ];

  const urlPatternBonus = urlPatterns
    .filter(({ pattern }) => lowerUrl.includes(pattern))
    .reduce((acc, { bonus, label }) => {
      reasons.push(`${label}(+${bonus})`);
      return acc + bonus;
    }, 0);
  score += urlPatternBonus;

  // ネガティブパターンチェック（関数型）
  const negativeMatches = NEGATIVE_PATTERNS.filter(negative =>
    lowerUrl.includes(negative) || lowerText.includes(negative)
  );
  const negativePenalty = negativeMatches.reduce((acc, negative) => {
    reasons.push(`negative_pattern:${negative}(-2)`);
    return acc - 2;
  }, 0);
  score += negativePenalty;

  console.log(`  Final purity score: ${score} (reasons: ${reasons.join(', ')})`);
  return { score: Math.max(0, score), reasons };
};

/**
 * HTML内容からキーワード検出（関数型）
 */
export const detectKeywords = (html: string, keywords: string[] = HIGH_PRIORITY_CONTACT_KEYWORDS): KeywordDetectionResult => {
  const lowerHtml = html.toLowerCase();
  const foundKeywords = createKeywordMatcher(keywords)(lowerHtml);

  console.log(`Keyword detection: found ${foundKeywords.length} unique keywords: ${foundKeywords.join(',')}`);

  return {
    matchCount: foundKeywords.length,
    foundKeywords
  };
};

/**
 * 連絡先情報の検出（関数型）
 */
export const extractContactInfo = (content: string): ContactInfoResult => {
  const lowerContent = content.toLowerCase();

  const hasPhone = PHONE_PATTERNS.some(pattern => pattern.test(content));
  const hasEmail = EMAIL_PATTERN.test(content);
  const hasFormMention = FORM_MENTION_PATTERNS.some(pattern =>
    lowerContent.includes(pattern.toLowerCase())
  );

  // スコア計算（関数型）
  const scoreMapping = [
    { condition: hasPhone, points: 3 },
    { condition: hasEmail, points: 2 },
    { condition: hasFormMention, points: 1 }
  ];

  const score = scoreMapping
    .filter(({ condition }) => condition)
    .reduce((acc, { points }) => acc + points, 0);

  return {
    hasPhone,
    hasEmail,
    hasFormMention,
    score
  };
};

/**
 * 動的サイト用厳格キーワード検証（関数型）
 */
export const calculateDynamicSiteKeywordScore = (html: string): number => {
  const lowerHtml = html.toLowerCase();

  // 各種キーワードのスコア計算を関数型で実装
  const scoreCalculators = [
    {
      keywords: DYNAMIC_CONTACT_KEYWORDS,
      multiplier: 3,
      label: 'contact'
    },
    {
      keywords: DYNAMIC_INDUCTION_PHRASES,
      multiplier: 5,
      label: 'induction'
    },
    {
      keywords: DYNAMIC_FORM_HINTS,
      multiplier: 4,
      label: 'form_hint'
    }
  ];

  const totalScore = scoreCalculators.reduce((total, { keywords, multiplier, label }) => {
    const score = keywords.reduce((acc, keyword) => {
      const matches = (lowerHtml.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      if (matches > 0) {
        console.log(`Found ${matches} occurrences of "${keyword}" (${label})`);
      }
      return acc + (matches * multiplier);
    }, 0);
    return total + score;
  }, 0);

  console.log(`Dynamic site keyword score calculated: ${totalScore}`);
  return totalScore;
};

// 後方互換性のためのクラス（段階的移行用）
export class KeywordMatcher {
  static calculateContactPurity = calculateContactPurity;
  static getKeywordWeight = getKeywordWeight;
  static detectKeywords = detectKeywords;
  static extractContactInfo = extractContactInfo;
  static calculateDynamicSiteKeywordScore = calculateDynamicSiteKeywordScore;

  static getHighPriorityKeywords(): string[] {
    return [...HIGH_PRIORITY_CONTACT_KEYWORDS];
  }

  static getAllKeywords(): string[] {
    return [...CONTACT_KEYWORDS];
  }
}
