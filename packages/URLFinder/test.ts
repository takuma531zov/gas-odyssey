// 新フロー動作確認テスト
function testNewFlow() {
  console.log('=== URLFinder 新フロー動作テスト ===');
  
  try {
    // テストURL（問い合わせページが確実に存在する）
    const testUrl = 'https://www.shuttlerock.co.jp';
    
    console.log(`テスト対象: ${testUrl}`);
    const result = ContactPageFinder.findContactPage(testUrl);
    
    console.log('=== 結果 ===');
    console.log(`contactUrl: ${result.contactUrl}`);
    console.log(`actualFormUrl: ${result.actualFormUrl}`);
    console.log(`foundKeywords: ${result.foundKeywords.join(', ')}`);
    console.log(`searchMethod: ${result.searchMethod}`);
    
    // 成功判定
    if (result.contactUrl) {
      console.log('✅ テスト成功: 問い合わせページが見つかりました');
    } else {
      console.log('❌ テスト失敗: 問い合わせページが見つかりませんでした');
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

// テスト実行
testNewFlow();