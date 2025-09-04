/**
 * 🎯 URLFinder メイン検索統合関数
 *
 * ステークホルダー可視化: フォルダ構造により処理フローが一目瞭然
 * ロジック完全維持: 既存の処理順序・結果を100%保証
 *
 * 📋 実行フロー:
 * Step 1: 前処理 → SNS判定・ドメイン検証
 * Step 2: URLパターン検索 → /contact等の高確率パターンテスト
 * Step 3: HTML解析 → トップページ詳細解析
 * Step 4: フォールバック → 蓄積情報からベスト候補選出
 *
 * @param baseUrl 検索対象のURL
 * @returns 検索結果
 */

import type { ContactPageResult } from './common/types';
import { createEmptyState } from './common/state';
import { extractDomain } from './common/network/url';
import { snsCheck, domainCheck } from './flows/00_preprocessing';
import { urlPatternSearch } from './flows/01_urlPattern';
import { htmlAnalysisSearch } from './flows/02_htmlAnalysis';
import { fallbackSearch } from './flows/03_fallback';

export function findContactPage(baseUrl: string): ContactPageResult {
  // ============================================
  // Step 1: 前処理フロー（SNS判定 + ドメイン検証）
  // ============================================

  const snsResult = snsCheck(baseUrl);
  if (snsResult) return snsResult;

  const domainResult = domainCheck(baseUrl);
  if (domainResult) return domainResult;

  // ============================================
  // Step 2: 検索戦略フロー（3段階戦略実行）
  // ============================================

  let state = createEmptyState();
  const domainUrl = extractDomain(baseUrl);
  let result: ContactPageResult | null = null;

  try {
    // 検索戦略を配列として定義
    const strategies = [
      urlPatternSearch,   // 2-1: URLパターン検索戦略
      htmlAnalysisSearch, // 2-2: HTML解析戦略
      fallbackSearch,     // 2-3: フォールバック戦略
    ];

    // 戦略を順番に実行し、結果が見つかり次第ループを抜ける
    for (const strategy of strategies) {
      const strategyResult = strategy(domainUrl, state);
      state = strategyResult.newState;
      result = strategyResult.result;
      if (result) break;
    }

    if (result) {
        if (result.contactUrl) {
            console.log(`✅ Found contact form: ${result.contactUrl}`);
        } else {
            console.log(`Search completed with result: ${result.searchMethod}`);
        }
        return result;
    }

  } catch (error) {
    console.error('Error in search strategies:', error);
  }

  // ============================================
  // Step 3: 全戦略失敗時の最終処理
  // ============================================
  return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'not_found' };
}
