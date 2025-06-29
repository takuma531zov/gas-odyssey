// main.ts
function onOpen(): void {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('データ処理')
    .addItem('日付順ソート実行', 'sortByDate')
    .addItem('データ検証', 'validateAndCleanDateData')
    .addToUi();
}

/**
 * 年跨ぎを考慮した日付昇順ソート（三井住友カード優先）
 */
export function sortByDate(): void {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // ヘッダー2行をスキップして、データ範囲を取得
    if (lastRow <= 2) {
      SpreadsheetApp.getUi().alert('データが存在しません');
      return;
    }

    // データを取得（3行目から最終行まで）
    const dataRange = sheet.getRange(3, 1, lastRow - 2, lastCol);
    const data = dataRange.getValues();

    // データに含まれる月を確認（年跨ぎ判定用）
    const months = [...new Set(data.map(row => parseInt(row[1]) || 0))];
    const hasDecAndJan = months.includes(12) && months.includes(1);

    console.log('データに含まれる月:', months);
    console.log('12月と1月の年跨ぎパターン:', hasDecAndJan);

    // ソート用のデータ配列を作成
    const sortableData = data.map((row, index) => {
      const month = parseInt(row[1]) || 0; // B列（月）
      const day = parseInt(row[2]) || 0;   // C列（日）
      const dColumn = row[3] ? row[3].toString() : ''; // D列

      // 年跨ぎ考慮の月変換
      let sortMonth;
      if (hasDecAndJan && month === 12) {
        // 12月と1月が両方存在する場合のみ、12月を優先（0にする）
        sortMonth = 0;
      } else if (hasDecAndJan && month === 1) {
        // 12月と1月が両方存在する場合のみ、1月を後に（13にする）
        sortMonth = 13;
      } else {
        // その他の場合は通常の月昇順
        sortMonth = month;
      }

      // 三井住友カードフラグ（含む場合は0、含まない場合は1で優先度設定）
      const mitsuiFlag = dColumn.includes('三井住友カード') ? 0 : 1;

      return {
        originalRow: row,
        sortMonth: sortMonth,
        day: day,
        mitsuiFlag: mitsuiFlag,
        originalIndex: index,
        originalMonth: month  // デバッグ用
      };
    });

    // 複合ソート実行
    sortableData.sort((a, b) => {
      // 1次ソート：月（年跨ぎ考慮）
      if (a.sortMonth !== b.sortMonth) {
        return a.sortMonth - b.sortMonth;
      }

      // 2次ソート：日
      if (a.day !== b.day) {
        return a.day - b.day;
      }

      // 3次ソート：三井住友カード優先
      if (a.mitsuiFlag !== b.mitsuiFlag) {
        return a.mitsuiFlag - b.mitsuiFlag;
      }

      // 4次ソート：元の順序を保持（安定ソート）
      return a.originalIndex - b.originalIndex;
    });

    // ソート結果をログ出力（デバッグ用）
    console.log('ソート結果の最初の10件:');
    sortableData.slice(0, 10).forEach((item, index) => {
      const mitsuiText = item.mitsuiFlag === 0 ? '[三井住友]' : '[一般]';
      console.log(`${index + 1}: ${item.originalMonth}/${item.day} ${mitsuiText} (ソート月:${item.sortMonth})`);
    });

    // ソート結果を元のデータ形式に戻す
    const sortedData = sortableData.map(item => item.originalRow);

    // データを書き戻し
    dataRange.setValues(sortedData);

    const yearCrossingText = hasDecAndJan ? '（年跨ぎ対応）' : '';
    SpreadsheetApp.getUi().alert(`日付順ソートが完了しました${yearCrossingText}`);
    console.log('日付順ソート完了 - 年跨ぎパターン:', hasDecAndJan);

  } catch (error) {
    console.error('ソート処理でエラーが発生しました:', error);
    SpreadsheetApp.getUi().alert('エラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
  }
}



/**
 * 日付データの検証とクリーニング
 */
function validateAndCleanDateData(): void {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 2) {
      SpreadsheetApp.getUi().alert('データが存在しません');
      return;
    }

    const dataRange = sheet.getRange(3, 2, lastRow - 2, 2); // B列とC列のデータ
    const dateData = dataRange.getValues();
    let invalidCount = 0;
    let fixedCount = 0;

    // 日付データの検証とクリーニング
    for (let i = 0; i < dateData.length; i++) {
      let month = dateData[i][0];
      let day = dateData[i][1];
      let monthUpdated = false;
      let dayUpdated = false;

      // 月の検証・修正
      if (typeof month === 'string') {
        const parsedMonth = parseInt(month.trim());
        if (!isNaN(parsedMonth)) {
          dateData[i][0] = parsedMonth;
          monthUpdated = true;
        }
      }

      // 日の検証・修正
      if (typeof day === 'string') {
        const parsedDay = parseInt(day.trim());
        if (!isNaN(parsedDay)) {
          dateData[i][1] = parsedDay;
          dayUpdated = true;
        }
      }

      // 修正カウント
      if (monthUpdated || dayUpdated) {
        fixedCount++;
        console.log(`行 ${i + 3}: データを数値に変換 - 月:${dateData[i][0]}, 日:${dateData[i][1]}`);
      }

      // 最終的な値を取得
      const finalMonth = dateData[i][0];
      const finalDay = dateData[i][1];

      // 日付の妥当性チェック
      if (isNaN(finalMonth) || isNaN(finalDay) ||
          finalMonth < 1 || finalMonth > 12 ||
          finalDay < 1 || finalDay > 31) {
        console.log(`行 ${i + 3}: 無効な日付データ - 月:${finalMonth}, 日:${finalDay}`);
        invalidCount++;
      }
    }

    // クリーニング済みデータを書き戻し
    dataRange.setValues(dateData);

    const message = `データ検証完了\n修正されたデータ: ${fixedCount} 件\n無効なデータ: ${invalidCount} 件`;
    SpreadsheetApp.getUi().alert(message);
    console.log('データ検証・クリーニング完了 - 修正:', fixedCount, '件, 無効:', invalidCount, '件');

  } catch (error) {
    console.error('データ検証でエラーが発生しました:', error);
    SpreadsheetApp.getUi().alert('エラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
  }
}
