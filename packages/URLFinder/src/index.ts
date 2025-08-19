// ==========================================
// 【URLFinder GAS統合エントリーポイント】
// Google Apps Script環境での問い合わせページ検索システム
// グローバル関数として公開（import使用、exportは削除）
// ==========================================

import type { ContactPageResult } from './types/interfaces';
import { ContactPageFinder } from './ContactPageFinder';

// GAS統合機能のインポート（内部使用のみ）
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
// 【GAS公開関数群】
// import した実装をグローバル関数として再定義
// ==========================================

/**
 * ContactPageFinder メイン処理関数
 * スプレッドシートのL列からURLを取得し、AP列に結果を出力
 */
function processContactPageFinder() {
  return gasProcessContactPageFinder();
}

/**
 * テスト用関数
 * 任意のURLでContactPageFinderの動作をテスト
 */
function test() {
  return gasTest();
}

/**
 * スプレッドシートUI付きURLFinder実行関数
 * GAS上のスプレッドシートボタンから実行される
 */
function executeUrlFinderWithUI(): void {
  return gasExecuteUrlFinderWithUI();
}

/**
 * 選択されたオプションに基づいて処理を実行
 * @param mode 'normal' | 'checked'
 */
function executeSelectedMode(mode: string): void {
  return gasExecuteSelectedMode(mode);
}

/**
 * 通常処理（既存ロジックをそのまま使用）
 */
function executeNormalProcessing(): void {
  return gasExecuteNormalProcessing();
}

/**
 * チェック行のみ処理（新機能）
 */
function executeCheckedRowsProcessing(): void {
  return gasExecuteCheckedRowsProcessing();
}

/**
 * 指定行のL列からURLを取得
 */
function getUrlFromRow(rowNumber: number): string {
  return gasGetUrlFromRow(rowNumber);
}

/**
 * 結果をAP列に書き込み
 */
function writeResultToSheet(rowNumber: number, result: ContactPageResult): void {
  return gasWriteResultToSheet(rowNumber, result);
}

/**
 * AQ列でチェックされた行番号一覧を取得
 */
function getCheckedRows(): number[] {
  return gasGetCheckedRows();
}

/**
 * チェックされた行数を取得
 */
function getCheckedRowsCount(): number {
  return gasGetCheckedRowsCount();
}

/**
 * MAX_COUNT設定値を取得
 */
function getMaxCountSetting(): number {
  return gasGetMaxCountSetting();
}

// ==========================================
// 【後方互換性ラッパー関数】
// 既存のコードとの互換性を維持
// ==========================================

/**
 * 後方互換性維持のためのラッパー関数
 * 既存の呼び出し元コードを変更せずに新しいアーキテクチャを使用可能
 *
 * @param url 検索対象URL
 * @returns ContactPageResult 検索結果
 *
 * 使用例:
 * const result = findContactPage('https://example.com');
 * console.log(result.contactUrl); // 問い合わせページURL
 * console.log(result.searchMethod); // 使用された検索手法
 */
function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}