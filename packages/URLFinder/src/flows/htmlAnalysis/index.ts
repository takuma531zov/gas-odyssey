/**
 * 📄 HTML解析戦略
 * 
 * トップページのHTMLコンテンツを詳細解析
 * 埋め込みフォーム、Googleフォーム、外部フォームURL、リンク解析を実行
 */

import { executeHtmlAnalysisStrategy } from '../../pipelines/strategies';
import { SearchState } from '../../pipelines/state';
import type { ContactPageResult } from '../../data/types/interfaces';

/**
 * HTML解析実行
 * @param domainUrl 正規化済みドメインURL
 * @param searchState 検索状態管理オブジェクト
 * @returns 成功時は結果オブジェクト、失敗時はnull
 */
export function htmlAnalysis(domainUrl: string, searchState: SearchState): ContactPageResult | null {
  return executeHtmlAnalysisStrategy(domainUrl, searchState);
}