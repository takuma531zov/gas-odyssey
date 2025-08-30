/**
 * 🔄 フォールバック戦略
 * 
 * SearchStateに蓄積された部分的成功情報を活用
 * 前戦略で発見した200 OK URL群から品質スコア計算でベスト候補を選出
 */

import { executeFallbackStrategy } from '../../pipelines/strategies';
import { SearchState } from '../../pipelines/state';
import type { ContactPageResult } from '../../data/types/interfaces';

/**
 * フォールバック戦略実行
 * @param domainUrl 正規化済みドメインURL
 * @param searchState 検索状態管理オブジェクト
 * @returns 成功時は結果オブジェクト、失敗時はnull
 */
export function fallbackSearch(domainUrl: string, searchState: SearchState): ContactPageResult | null {
  return executeFallbackStrategy(domainUrl, searchState);
}