/**
 * 🎯 URLパターン検索戦略
 * 
 * 高確率問い合わせページURLパターンを順次テスト
 * /contact, /inquiry, /form, /contact-us 等の一般的パターンでアクセス検証
 */

import { executeUrlPatternStrategy } from '../../pipelines/strategies';
import { SearchState } from '../../pipelines/state';
import type { ContactPageResult } from '../../data/types/interfaces';

/**
 * URLパターン検索実行
 * @param domainUrl 正規化済みドメインURL
 * @param searchState 検索状態管理オブジェクト
 * @returns 成功時は結果オブジェクト、失敗時はnull
 */
export function urlPatternSearch(domainUrl: string, searchState: SearchState): ContactPageResult | null {
  return executeUrlPatternStrategy(domainUrl, searchState);
}