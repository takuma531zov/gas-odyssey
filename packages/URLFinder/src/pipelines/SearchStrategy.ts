/**
 * 検索戦略の基本インターフェース
 */

import type { ContactPageResult } from '../../data/types/interfaces';

export interface SearchStrategy {
  /**
   * 検索を実行
   * @param baseUrl 検索対象URL
   * @param domainUrl ドメインURL
   * @param startTime 開始時刻
   * @returns 検索結果
   */
  execute(baseUrl: string, domainUrl: string, startTime: number): ContactPageResult;
  
  /**
   * 戦略名を取得
   * @returns 戦略名
   */
  getStrategyName(): string;
}