/**
 * ログ出力ユーティリティ
 * 統一されたログフォーマットで出力
 */

/**
 * ログレベル
 */
type LogLevel = "INFO" | "WARN" | "ERROR";

/**
 * ログ出力（共通関数）
 */
const log = (level: LogLevel, message: string, details?: unknown): void => {
  const timestamp = new Date().toISOString();
  const logMessage = details
    ? `[${timestamp}] [${level}] ${message} | ${JSON.stringify(details)}`
    : `[${timestamp}] [${level}] ${message}`;
  Logger.log(logMessage);
};

/**
 * 情報ログ出力
 */
export const logInfo = (message: string, details?: unknown): void => {
  log("INFO", message, details);
};

/**
 * 警告ログ出力
 */
export const logWarn = (message: string, details?: unknown): void => {
  log("WARN", message, details);
};

/**
 * エラーログ出力
 */
export const logError = (message: string, error?: unknown): void => {
  if (error instanceof Error) {
    log("ERROR", message, {
      message: error.message,
      stack: error.stack,
    });
  } else {
    log("ERROR", message, error);
  }
};
