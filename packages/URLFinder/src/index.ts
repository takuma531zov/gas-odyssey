
/**
 * 📋 URLFinder - GAS関数エントリーポイント
 *
 * Google Apps Scriptで使用する関数の純粋な呼び出し専用ファイル
 *
 * 利用可能な関数:
 * - processContactPageFinder: スプレッドシート一括処理（通女処置/トリガー用）
 * - executeUrlFinderWithUI: UI選択型処理（通常処理/チェック行処理の分岐）
 *
 * デバッグ用関数:
 * - debug.tsのfindContactPageWithVisibility (別ファイルで提供)
 */

import { processContactPageFinder } from './adapters/gas/triggers';
import { executeUrlFinderWithUI } from './adapters/gas/ui';
import { findContactPageWithVisibility } from './debug';


// GASのグローバル空間に関数を登録
declare const global: {
  processContactPageFinder: typeof processContactPageFinder;
  executeUrlFinderWithUI: typeof executeUrlFinderWithUI;
  findContactPageWithVisibility: typeof findContactPageWithVisibility;
};

global.processContactPageFinder = processContactPageFinder;
global.executeUrlFinderWithUI = executeUrlFinderWithUI;
global.findContactPageWithVisibility = findContactPageWithVisibility;
