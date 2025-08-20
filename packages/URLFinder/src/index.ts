// ==========================================
// 【URLFinder GAS統合エントリーポイント】
// Google Apps Script環境での問い合わせページ検索システム
// グローバル関数として公開（import使用、exportは削除）
// ==========================================

import type { ContactPageResult } from './types/interfaces';
import { ContactPageFinder } from './ContactPageFinder';

import {
  processContactPageFinder as gasProcessContactPageFinder,
  test as gasTest,
  executeUrlFinderWithUI as gasExecuteUrlFinderWithUI,
  executeSelectedMode as gasExecuteSelectedMode,
  executeNormalProcessing as gasExecuteNormalProcessing,
  executeCheckedRowsProcessing as gasExecuteCheckedRowsProcessing,
  getUrlFromRow as gasGetUrlFromRow,
  writeResultToSheet as gasWriteResultToSheet,
  getCheckedRows as gasGetCheckedRows,
  getCheckedRowsCount as gasGetCheckedRowsCount,
  getMaxCountSetting as gasGetMaxCountSetting
} from './gas-integration';

// ==========================================
// 【GAS用グローバル名前空間】
// すべての関数を URLFinderGAS オブジェクトにまとめる
// ==========================================
const URLFinderGAS = {
  processContactPageFinder: () => gasProcessContactPageFinder(),
  test: () => gasTest(),
  executeUrlFinderWithUI: () => gasExecuteUrlFinderWithUI(),
  executeSelectedMode: (mode: string) => gasExecuteSelectedMode(mode),
  executeNormalProcessing: () => gasExecuteNormalProcessing(),
  executeCheckedRowsProcessing: () => gasExecuteCheckedRowsProcessing(),
  getUrlFromRow: (rowNumber: number) => gasGetUrlFromRow(rowNumber),
  writeResultToSheet: (rowNumber: number, result: ContactPageResult) =>
    gasWriteResultToSheet(rowNumber, result),
  getCheckedRows: () => gasGetCheckedRows(),
  getCheckedRowsCount: () => gasGetCheckedRowsCount(),
  getMaxCountSetting: () => gasGetMaxCountSetting(),
  findContactPage: (url: string) => ContactPageFinder.findContactPage(url)
};

// ==========================================
// 【グローバル関数として GAS に登録】
// GAS上では `URLFinderGAS.processContactPageFinder()` のように呼び出す
// ==========================================
(globalThis as any).URLFinderGAS = URLFinderGAS;
