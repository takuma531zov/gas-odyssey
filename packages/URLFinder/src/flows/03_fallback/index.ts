import type { StrategyResult } from "../../common/types";
import type { SearchStateData } from "../../common/types";
import { getFinalResult } from "../../common/state";
import { evaluateFallbackUrlQuality } from "./utils";

// 信頼度の閾値
const HIGH_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Fallback検索戦略
 * SearchStateに蓄積された情報を利用してフォールバック結果を提供
 */
export const fallbackSearch = (
  searchState: SearchStateData,
): StrategyResult => {

  const fallbackResult = getFinalResult(searchState);
  const { contactUrl, foundKeywords, searchMethod } = fallbackResult;

  if (contactUrl && foundKeywords.length > 0) {
    const pattern = foundKeywords.find((k: string) => k.startsWith("/")) || "";

    const { keywords, confidence } = evaluateFallbackUrlQuality(
      contactUrl,
      pattern,
    );
    foundKeywords.push(...keywords);

    if (searchMethod === "final_fallback") {
      fallbackResult.searchMethod =
        confidence >= HIGH_CONFIDENCE_THRESHOLD
          ? "final_fallback_high_confidence"
          : "final_fallback_low_confidence";
    }

    return { result: fallbackResult, newState: searchState };
  }

  return { result: null, newState: searchState };
};
