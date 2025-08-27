
import type { ContactPageResult } from '../../data/types/interfaces';
import { ContactPageFinder } from '../ContactPageFinder';

function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

/**
 * テスト用関数
 * 任意のURLでContactPageFinderの動作をテスト
 */
export function test() {
  // テスト用URL（任意に変更可能）
  const testUrl = 'https://www.alleyoop.co.jp/';

  console.log(`
=== URLFinder テスト実行: ${testUrl} ===`);
  const result = findContactPage(testUrl);

  console.log('=== Contact Page Finder Results ===');
  console.log(`Target URL: ${testUrl}`);
  console.log(`Contact URL: ${result.contactUrl}`);
  console.log(`Actual Form URL: ${result.actualFormUrl}`);
  console.log(`Found Keywords: ${result.foundKeywords.join(',')}`);
  console.log(`Search Method: ${result.searchMethod}`);
  console.log('=====================================');
}
