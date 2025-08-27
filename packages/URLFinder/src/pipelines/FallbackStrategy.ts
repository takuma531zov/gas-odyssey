
import type { ContactPageResult, SearchStrategy } from '../../data/types/interfaces';
import { SearchState } from '../core/SearchState';

export class FallbackStrategy implements SearchStrategy {
  public getStrategyName(): string {
    return 'Fallback';
  }

  public search(baseUrl: string, searchState: SearchState): ContactPageResult | null {
    const fallbackResult = searchState.getFinalResult();
    if (fallbackResult.contactUrl) {
      return fallbackResult;
    }
    return null;
  }
}
