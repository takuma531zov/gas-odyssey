import type { AttachmentFile, FileDiff } from "../types";
import {
  PARENT_FOLDER_ID,
  MAIL_BODY_SOURCE_COLUMN,
  REPORT_HEADER_ROW,
} from "../env";
import { SENT_FOLDER_NAME } from "../config/constants";

/**
 * 親フォルダを取得
 * @returns 親フォルダオブジェクト
 */
const getParentFolder = (): GoogleAppsScript.Drive.Folder => {
  return DriveApp.getFolderById(PARENT_FOLDER_ID);
};

/**
 * 指定フォルダ内の送信済みフォルダを取得または作成
 * @param agencyFolder 代理店フォルダ
 * @returns 送信済みフォルダ
 */
const getSentFolder = (
  agencyFolder: GoogleAppsScript.Drive.Folder,
): GoogleAppsScript.Drive.Folder => {
  const sentFolders = agencyFolder.getFoldersByName(SENT_FOLDER_NAME);

  if (sentFolders.hasNext()) {
    return sentFolders.next();
  }

  // 送信済みフォルダが存在しない場合は作成
  return agencyFolder.createFolder(SENT_FOLDER_NAME);
};

/**
 * 送信済みフォルダ内の年フォルダを取得または作成
 * @param sentFolder 送信済みフォルダ
 * @returns 年フォルダ
 */
const getYearFolder = (
  sentFolder: GoogleAppsScript.Drive.Folder,
): GoogleAppsScript.Drive.Folder => {
  const currentYear = new Date().getFullYear().toString();
  const yearFolders = sentFolder.getFoldersByName(currentYear);

  if (yearFolders.hasNext()) {
    return yearFolders.next();
  }

  return sentFolder.createFolder(currentYear);
};

/**
 * 年フォルダ内の月フォルダを取得または作成
 * @param yearFolder 年フォルダ
 * @returns 月フォルダ
 */
const getMonthFolder = (
  yearFolder: GoogleAppsScript.Drive.Folder,
): GoogleAppsScript.Drive.Folder => {
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const monthFolders = yearFolder.getFoldersByName(currentMonth);

  if (monthFolders.hasNext()) {
    return monthFolders.next();
  }

  return yearFolder.createFolder(currentMonth);
};

/**
 * スプレッドシートの全データを2次元配列で取得
 * @param file スプレッドシートファイル
 * @returns 2次元配列データ
 */
const getSpreadsheetData = (
  file: GoogleAppsScript.Drive.File,
): string[][] => {
  const spreadsheet = SpreadsheetApp.open(file);
  const sheet = spreadsheet.getSheets()[0]; // 最初のシートを取得
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    return [];
  }

  return sheet.getRange(1, 1, lastRow, lastCol).getValues() as string[][];
};

/**
 * 2つのスプレッドシートのデータを比較して差分を抽出
 * @param oldData 旧データ
 * @param newData 新データ
 * @param targetColumn MAIL_BODY_SOURCE_COLUMN列番号（1始まり）
 * @param headerRow ヘッダー行の配列
 * @returns 差分情報の配列
 */
const compareSpreadsheetData = (
  oldData: string[][],
  newData: string[][],
  targetColumn: number,
  headerRow: string[],
): FileDiff[] => {
  const diffs: FileDiff[] = [];

  // 旧データをMap化（行番号 -> データ）
  const oldDataMap = new Map<number, string[]>();
  for (let i = 0; i < oldData.length; i++) {
    oldDataMap.set(i, oldData[i]);
  }

  // 新データと比較
  for (let rowIndex = 0; rowIndex < newData.length; rowIndex++) {
    const newRow = newData[rowIndex];
    const oldRow = oldDataMap.get(rowIndex);

    // 新規追加行の場合
    if (!oldRow) {
      diffs.push({
        rowNumber: rowIndex + 1, // 1始まりに変換
        value: newRow[targetColumn - 1] || "", // 0始まりに変換
        changeType: "new",
      });
      continue;
    }

    // 変更された列を特定
    const changedColumnIndices: number[] = [];
    for (let colIndex = 0; colIndex < newRow.length; colIndex++) {
      if (newRow[colIndex] !== oldRow[colIndex]) {
        changedColumnIndices.push(colIndex);
      }
    }

    // 変更がある場合
    if (changedColumnIndices.length > 0) {
      // 変更列のヘッダー名を取得
      const changedColumnNames = changedColumnIndices
        .map((colIndex) => headerRow[colIndex] || "")
        .filter((name) => name !== "");

      diffs.push({
        rowNumber: rowIndex + 1,
        value: newRow[targetColumn - 1] || "",
        changeType: "updated",
        changedColumnNames,
      });
    }
  }

  return diffs;
};

/**
 * 送信済みフォルダから最新のファイルを取得
 * @param agencyFolder 代理店フォルダ
 * @returns 最新ファイル（存在しない場合はnull）
 */
const getLatestSentFile = (
  agencyFolder: GoogleAppsScript.Drive.Folder,
): GoogleAppsScript.Drive.File | null => {
  const sentFolder = getSentFolder(agencyFolder);
  const yearFolder = getYearFolder(sentFolder);
  const monthFolder = getMonthFolder(yearFolder);

  const files = monthFolder.getFiles();
  let latestFile: GoogleAppsScript.Drive.File | null = null;
  let latestDate = new Date(0);

  while (files.hasNext()) {
    const file = files.next();
    const lastUpdated = file.getLastUpdated().getTime();

    if (lastUpdated > latestDate.getTime()) {
      latestDate = new Date(lastUpdated);
      latestFile = file;
    }
  }

  return latestFile;
};

/**
 * 代理店の添付対象ファイルを取得
 * @param companyName 会社名
 * @returns 添付ファイル情報（ファイルが存在しない場合はnull）
 */
export const getAttachmentFile = (
  companyName: string,
): AttachmentFile | null => {
  const parentFolder = getParentFolder();
  const agencyFolders = parentFolder.getFoldersByName(companyName);

  if (!agencyFolders.hasNext()) {
    return null;
  }

  const agencyFolder = agencyFolders.next();

  // 添付対象ファイルを検索（送信済みフォルダ以外）
  const files = agencyFolder.getFiles();
  let attachmentFile: GoogleAppsScript.Drive.File | null = null;

  while (files.hasNext()) {
    const file = files.next();
    // スプレッドシートのみを対象
    if (
      file.getMimeType() === "application/vnd.google-apps.spreadsheet" &&
      !file.getName().startsWith(".")
    ) {
      attachmentFile = file;
      break;
    }
  }

  if (!attachmentFile) {
    return null;
  }

  // 最新の送信済みファイルを取得
  const latestSentFile = getLatestSentFile(agencyFolder);

  // 新データを取得
  const newData = getSpreadsheetData(attachmentFile);

  // ヘッダー行を取得（REPORT_HEADER_ROWで指定された行）
  const headerRowIndex = Number.parseInt(REPORT_HEADER_ROW, 10) - 1; // 0始まりに変換
  const headerRow = newData[headerRowIndex] || [];

  // 差分を計算
  let diffs: FileDiff[] = [];
  if (latestSentFile) {
    const oldData = getSpreadsheetData(latestSentFile);
    diffs = compareSpreadsheetData(
      oldData,
      newData,
      MAIL_BODY_SOURCE_COLUMN,
      headerRow,
    );
  } else {
    // 送信済みファイルがない場合は全行を新規追加として扱う
    diffs = newData.map((row, index) => ({
      rowNumber: index + 1,
      value: row[MAIL_BODY_SOURCE_COLUMN - 1] || "",
      changeType: "new" as const,
    }));
  }

  return {
    file: attachmentFile,
    url: attachmentFile.getUrl(),
    diffs,
  };
};

/**
 * 添付ファイルを送信済みフォルダに移動
 * @param companyName 会社名
 * @param file 移動対象ファイル
 */
export const moveFileToSentFolder = (
  companyName: string,
  file: GoogleAppsScript.Drive.File,
): void => {
  const parentFolder = getParentFolder();
  const agencyFolders = parentFolder.getFoldersByName(companyName);

  if (!agencyFolders.hasNext()) {
    throw new Error(`代理店フォルダ "${companyName}" が見つかりません`);
  }

  const agencyFolder = agencyFolders.next();
  const sentFolder = getSentFolder(agencyFolder);
  const yearFolder = getYearFolder(sentFolder);
  const monthFolder = getMonthFolder(yearFolder);

  // ファイルをコピーして移動
  file.makeCopy(file.getName(), monthFolder);

  // 元のファイルを削除
  file.setTrashed(true);
};
