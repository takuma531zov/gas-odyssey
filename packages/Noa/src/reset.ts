export function clearAllData(): void {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const lastRow = sheet.getLastRow();

    // ヘッダー2行以下にデータがあるかチェック
    if (lastRow <= 2) {
      SpreadsheetApp.getUi().alert('削除するデータがありません');
      return;
    }

    // 確認ダイアログ
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'データ削除確認',
      `ヘッダー行以下の全データ（${lastRow - 2}行）を削除しますか？`,
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    // 3行目から最終行まで削除
    const deleteRange = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn());
    deleteRange.clear();

    SpreadsheetApp.getUi().alert(`${lastRow - 2}行のデータを削除しました`);
    console.log('データ一括削除完了:', lastRow - 2, '行');

  } catch (error) {
    console.error('データ削除でエラーが発生しました:', error);
    SpreadsheetApp.getUi().alert('エラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
  }
}
