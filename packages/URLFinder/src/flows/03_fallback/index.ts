import type {  StrategyResult } from '../../common/types/types';
import type { SearchStateData } from '../../common/types/types';
import { getFinalResult } from '../../common/state';
import { evaluateFallbackUrlQuality } from './utils';

/**
 * Fallback検索戦略
 * SearchStateに蓄積された情報を利用してフォールバック結果を提供
 */
export const fallbackSearch = (baseUrl: string, searchState: SearchStateData): StrategyResult => {
  const fallbackResult = getFinalResult(searchState);

  if (fallbackResult.contactUrl && fallbackResult.foundKeywords.length > 0) {
    const pattern = fallbackResult.foundKeywords.find((k: string) => k.startsWith('/')) || '';
    const qualityScore = evaluateFallbackUrlQuality(fallbackResult.contactUrl, pattern);

    fallbackResult.foundKeywords.push(...qualityScore.keywords);
    if (fallbackResult.searchMethod === 'final_fallback') {
        fallbackResult.searchMethod = qualityScore.confidence >= 0.7 ? 'final_fallback_high_confidence' : 'final_fallback_low_confidence';
    }

    return { result: fallbackResult, newState: searchState };
  }

  return { result: null, newState: searchState };
};
