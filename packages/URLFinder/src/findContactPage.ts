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

import type { ContactPageResult } from './data/types/interfaces';
import { SearchState } from './pipelines/state';
import { NetworkUtils } from './functions/network/fetch';
import { snsCheck, domainCheck, urlPatternSearch, htmlAnalysis, fallbackSearch } from './flows';

export function findContactPage(baseUrl: string): ContactPageResult {
  // ============================================
  // Step 1: 前処理フロー（SNS判定 + ドメイン検証）
  // ============================================

  // 1-1: SNS判定
  const snsResult = snsCheck(baseUrl);
  if (snsResult) return snsResult;

  // 1-2: ドメイン可用性チェック
  const domainResult = domainCheck(baseUrl);
  if (domainResult) return domainResult;

  // ============================================
  // Step 2: 検索戦略フロー（3段階戦略実行）
  // ============================================

  const searchState = new SearchState();
  const domainUrl = NetworkUtils.extractDomain(baseUrl);

  try {
    // 2-1: URLパターン検索戦略（高確率パターンテスト）
    const urlPatternResult = urlPatternSearch(domainUrl, searchState);
    if (urlPatternResult) {
      if (urlPatternResult.contactUrl) {
        console.log(`✅ Found contact form: ${urlPatternResult.contactUrl}`);
      } else {
        console.log(`Search completed with result: ${urlPatternResult.searchMethod}`);
      }
      return urlPatternResult;
    }

    // 2-2: HTML解析戦略（トップページ詳細解析）
    const htmlResult = htmlAnalysis(domainUrl, searchState);
    if (htmlResult) {
      if (htmlResult.contactUrl) {
        console.log(`✅ Found contact form: ${htmlResult.contactUrl}`);
      } else {
        console.log(`Search completed with result: ${htmlResult.searchMethod}`);
      }
      return htmlResult;
    }

    // 2-3: フォールバック戦略（蓄積情報活用）
    const fallbackResult = fallbackSearch(domainUrl, searchState);
    if (fallbackResult) {
      if (fallbackResult.contactUrl) {
        console.log(`✅ Found contact form: ${fallbackResult.contactUrl}`);
      } else {
        console.log(`Search completed with result: ${fallbackResult.searchMethod}`);
      }
      return fallbackResult;
    }

  } catch (error) {
    console.error('Error in search strategies:', error);
  }

  // ============================================
  // Step 3: 全戦略失敗時の最終処理
  // ============================================
  return { contactUrl: null, actualFormUrl: null, foundKeywords: [], searchMethod: 'not_found' };
}
