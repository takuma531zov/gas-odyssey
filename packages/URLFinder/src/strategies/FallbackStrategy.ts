/**
 * 最終フォールバック戦略
 * Step1、Step2が失敗した場合の最後の手段
 */

import { ContactPageResult, SearchStrategy } from '../types/interfaces';

export class FallbackStrategy implements SearchStrategy {

  /**
   * 戦略名を取得
   */
  getStrategyName(): string {
    return 'Fallback Strategy (Final)';
  }

  /**
   * 最終フォールバック検索の実行
   */
  search(_baseUrl: string): ContactPageResult | null {
    console.log(`=== ${this.getStrategyName()} Starting ===`);
    console.log('All primary strategies failed - returning not found result');
    
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['not_found'],
      searchMethod: 'not_found'
    };
  }
}