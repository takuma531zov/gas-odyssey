// イベント重複検出モジュール
// CacheServiceを使用してSlack Eventの重複実行を防止

import { logInfo, logWarn } from "../../../../common/src/logger";

const CACHE_PREFIX = "slack_event_";
const CACHE_EXPIRATION_SECONDS = 60 * 5; // 5分間保持

/**
 * イベントが処理済みかどうかを判定
 * @param eventId Slack Event ID
 * @returns 処理済みならtrue
 */
export const isDuplicateEvent = (eventId: string): boolean => {
	const cache = CacheService.getScriptCache();
	const key = `${CACHE_PREFIX}${eventId}`;
	const cached = cache.get(key);

	if (cached) {
		logWarn("Duplicate event detected, skipping", { eventId });
		return true;
	}

	return false;
};

/**
 * イベントを処理済みとしてマーク
 * @param eventId Slack Event ID
 */
export const markEventAsProcessed = (eventId: string): void => {
	const cache = CacheService.getScriptCache();
	const key = `${CACHE_PREFIX}${eventId}`;
	cache.put(key, "1", CACHE_EXPIRATION_SECONDS);
	logInfo("Event marked as processed", { eventId });
};
