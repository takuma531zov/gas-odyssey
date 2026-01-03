/**
 * ステータス更新
 * スプレッドシートの指定行のステータスを更新
 */

import { getSheet, setValueSheet } from "../../../common/src/spreadsheet";
import { BLOG_ARTICLE_LIST_SHEET_NAME, STATUS_COLUMN } from "../env";
import { logInfo } from "../utils/logger";

/**
 * ステータスを更新
 * @param rowIndex スプレッドシートの行番号
 * @param status 新しいステータス値（「投稿済み」または「投稿失敗」）
 */
export const updateStatus = (rowIndex: number, status: string): void => {
  const sheet = getSheet(BLOG_ARTICLE_LIST_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `シートが見つかりません: ${BLOG_ARTICLE_LIST_SHEET_NAME}`,
    );
  }

  setValueSheet(sheet, rowIndex, STATUS_COLUMN, status);
  logInfo(`ステータスを更新しました: 行${rowIndex} → ${status}`);
};
