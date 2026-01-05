/**
 * Dify連携
 * 処理結果を各著者のDifyワークフローに通知
 *
 * 処理フロー：
 * 1. notifyResults() - 全記事の処理結果を著者ごとにグループ化してDifyに送信
 */

export { notifyResults } from "./notifyResults";
