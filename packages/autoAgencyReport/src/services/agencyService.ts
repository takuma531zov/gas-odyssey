import { getSheet, getRowData2D } from "../../../common/src/spreadsheet";
import type { Agency } from "../types";
import { SHEET_AGENCY_LIST_NAME } from "../env";
import {
  AGENCY_LIST_COLUMNS,
  HEADER_ROW_NUMBER,
  DATA_START_ROW_NUMBER,
} from "../config/constants";
import { isTodaySendDay } from "../utils/dateUtils";

/**
 * カンマ区切り文字列を配列に変換（空白除去）
 * @param value カンマ区切り文字列
 * @returns 配列
 */
const parseCommaSeparatedValues = (value: string): string[] => {
  if (!value || value.trim() === "") {
    return [];
  }
  return value.split(",").map((item) => item.trim());
};

/**
 * 代理店リストシートから行データを代理店情報型に変換
 * @param row 行データ（配列）
 * @returns 代理店情報
 */
const rowToAgency = (row: string[]): Agency => {
  return {
    companyName: row[AGENCY_LIST_COLUMNS.COMPANY_NAME] || "",
    personInCharge: row[AGENCY_LIST_COLUMNS.PERSON_IN_CHARGE] || undefined,
    templateName: row[AGENCY_LIST_COLUMNS.TEMPLATE_NAME] || "",
    platform: row[AGENCY_LIST_COLUMNS.PLATFORM] as Agency["platform"],
    roomId: row[AGENCY_LIST_COLUMNS.ROOM_ID] || undefined,
    toAddresses: parseCommaSeparatedValues(
      row[AGENCY_LIST_COLUMNS.TO_ADDRESSES],
    ),
    ccAddresses:
      parseCommaSeparatedValues(row[AGENCY_LIST_COLUMNS.CC_ADDRESSES]) ||
      undefined,
    sendDays: parseCommaSeparatedValues(row[AGENCY_LIST_COLUMNS.SEND_DAYS]),
  };
};

/**
 * 代理店リストから全代理店情報を取得
 * @returns 代理店情報の配列
 */
export const getAllAgencies = (): Agency[] => {
  const sheet = getSheet(SHEET_AGENCY_LIST_NAME);
  const rows = getRowData2D(sheet, HEADER_ROW_NUMBER, DATA_START_ROW_NUMBER);

  return rows.map(rowToAgency);
};

/**
 * 本日送信対象の代理店情報を取得
 * @returns 本日送信対象の代理店情報の配列
 */
export const getTodayTargetAgencies = (): Agency[] => {
  const allAgencies = getAllAgencies();

  return allAgencies.filter((agency) => {
    // 送信日が設定されていない場合はスキップ
    if (agency.sendDays.length === 0) {
      return false;
    }

    // 本日の曜日が送信対象かチェック
    return isTodaySendDay(agency.sendDays);
  });
};
