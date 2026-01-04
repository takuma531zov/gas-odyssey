/**
 * 対象記事取得
 * スプレッドシートから条件に合う記事を取得
 */

import { getSheet, getRowData2D } from "../../../common/src/spreadsheet";
import {
  BLOG_ARTICLE_LIST_SHEET_NAME,
  POSTING_DATE_COLUMN,
  PLATFORM_COLUMN,
  STATUS_COLUMN,
  ARTICLE_TITLE_COLUMN,
  AUTHOR_COLUMN,
} from "../env";
import { SHEET_STATUS, PLATFORM } from "../constants";
import { getTomorrow, formatDate } from "../utils/dateUtils";
import { logInfo } from "../utils/logger";
import type { Article } from "../types";

/**
 * 対象記事を取得
 * 条件: POSTING_DATE_COLUMNが明日 & PLATFORM_COLUMNに"Apsis"を含む & STATUS_COLUMNが"投稿準備完了"
 * @returns 対象記事の配列
 */
export const getTargetArticles = (): Article[] => {
  const sheet = getSheet(BLOG_ARTICLE_LIST_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `シートが見つかりません: ${BLOG_ARTICLE_LIST_SHEET_NAME}`,
    );
  }

  // 全行取得（ヘッダー行=1行目、データ開始行=2行目）
  const data = getRowData2D(sheet, 1, 2);

  const tomorrow = getTomorrow(); // 明日の日付（YYYY/MM/DD形式）
  const targetArticles: Article[] = [];

  // 各行をチェック
  data.forEach((row, index) => {
    const rowIndex = index + 2; // スプレッドシートの実際の行番号（ヘッダー除く）

    // 各列の値を取得（列番号は1始まりなので-1）
    const postingDateValue = row[POSTING_DATE_COLUMN - 1];
    const platformValue = String(row[PLATFORM_COLUMN - 1]);
    const statusValue = String(row[STATUS_COLUMN - 1]);
    const titleValue = String(row[ARTICLE_TITLE_COLUMN - 1]);
    const authorValue = String(row[AUTHOR_COLUMN - 1]);

    // 投稿日をフォーマット（Date型の場合を考慮）
    const postingDate =
      (postingDateValue as unknown) instanceof Date
        ? formatDate(postingDateValue as unknown as Date)
        : String(postingDateValue);

    // 条件チェック
    const isTargetDate = postingDate === tomorrow;
    const isPlatformApsis = platformValue.includes(PLATFORM.APSIS);
    const isStatusReady = statusValue === SHEET_STATUS.READY;

    if (isTargetDate && isPlatformApsis && isStatusReady) {
      targetArticles.push({
        rowIndex,
        title: titleValue,
        author: authorValue,
        postingDate,
      });
    }
  });

  logInfo(`対象記事を${targetArticles.length}件取得しました`, {
    tomorrow,
    articles: targetArticles.map((a) => a.title),
  });

  return targetArticles;
};
