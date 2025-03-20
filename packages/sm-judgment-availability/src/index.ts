// const myFunction = () => {
//   //1.スプレッドシートのデータ取得
//   //指定した範囲のデータを取得し、各行ごとにDify APIにリクエストを送る。
//   //2.Dify APIへのリクエスト
//   //Difyを用いて各行のデータの整合性を判定し、結果を取得。
//   //3.判定結果をスプレッドシートに書き込む
//   //4.falseのデータを別シートに保存
//Aにチェックボックスを入れる
//フォーマットの一致
//プロンプトをマークダウン
//   console.log("Hello");
// };
// declare let global: any;
// global.main = myFunction;
// //API連携確認
// function runWorkflow() {
//   var url = "https://ec47-103-5-140-129.ngrok-free.app/v1/workflows/run";
//   var apiKey = PropertiesService.getScriptProperties().getProperty("API_KEY");

//   var requestBody = {
//     inputs: {
//       input: "りんご",
//     },
//     response_mode: "blocking", // streaming ではなく blocking を推奨
//     user: "abc-123",
//   };

//   var options = {
//     method: "post",
//     headers: {
//       Authorization: "Bearer " + apiKey,
//       "Content-Type": "application/json",
//     },
//     payload: JSON.stringify(requestBody),
//     muteHttpExceptions: true, // エラー時にレスポンスを取得する
//   };

//   try {
//     var response = UrlFetchApp.fetch(url, options);
//     var data = JSON.parse(response.getContentText());
//     Logger.log("Response: " + JSON.stringify(data));
//   } catch (error) {
//     Logger.log("Error: " + error.message);
//   }
// }
declare let global: any;
global.main = runWorkflow;

// runWorkflow();

//スプシ情報取得
function updateCheckboxes() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var aRange = sheet.getRange(2, 1, lastRow - 1, 1);
  var bValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var aValues = aRange.getValues();
  for (var i = 0; i < bValues.length; i++) {
    if (bValues[i][0] !== "") {
      if (aValues[i][0] === "") {
        sheet.getRange(i + 2, 1).insertCheckboxes();
      }
    } else {
      sheet.getRange(i + 2, 1).setValue("");
    }
  }
}
function toggleCheckboxes() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var valuesA = sheet.getRange("A2:A" + lastRow).getValues();
  var lastCheckboxRow = 1;
  for (var i = valuesA.length - 1; i >= 0; i--) {
    if (valuesA[i][0] === true || valuesA[i][0] === false) {
      lastCheckboxRow = i + 2;
      break;
    }
  }
  if (lastCheckboxRow < 2) return;
  var rangeA = sheet.getRange("A2:A" + lastCheckboxRow);
  var values = rangeA.getValues();
  for (var i = 0; i < values.length; i++) {
    values[i][0] = !values[i][0];
  }
  rangeA.setValues(values);
}
function getSpreadsheetData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1");
  var lastRow = sheet.getLastRow();
  var checkboxes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var data = sheet.getRange(2, 3, lastRow - 1, 3).getValues();
  var records = [];
  var rowIndexes = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i][0] === true) {
      var record = data[i].filter((cell) => cell !== "").join("/");
      if (record) {
        records.push(record);
        rowIndexes.push(i + 2);
      }
    }
  }
  if (records.length === 0) {
    Logger.log("チェックされたデータがありません");
    return null;
  }
  Logger.log("取得データ: " + JSON.stringify(records));
  return { records, rowIndexes };
}
function prepareRequestData(record) {
  if (!record || record.length === 0) {
    Logger.log("入力データがありません");
    return null;
  }

  // データの正規化処理
  function normalizeText(text) {
    // 全角を半角に変換
    text = text.normalize("NFKC");

    // 「棟」「号棟」「号室」を削除して「*」に変換
    text = text.replace(/(号?棟|号室)/g, "*");

    // 空白とハイフン（半角・全角）を「*」に変換
    text = text.replace(/[\s\-‐‑‒–—―ー]/g, "*");

    // 連続する "*" を 1 つにまとめる
    text = text.replace(/\*+/g, "*");

    // 先頭・末尾の "*" を削除
    text = text.replace(/^\*+|\*+$/g, "");

    return text;
  }

  // 文字列の正規化を適用
  let normalizedRecords = record.split("/").map(normalizeText).filter(Boolean); // 空のデータを削除

  if (normalizedRecords.length === 0) {
    Logger.log("有効なデータがありません");
    return null;
  }

  return {
    inputs: { text: JSON.stringify(normalizedRecords) },
    response_mode: "blocking",
    user: "abc-123",
  };
}

function sendDataToDify(requestBody, rowIndex) {
  if (!requestBody) {
    Logger.log("リクエストデータが不正です");
    return;
  }
  Logger.log("送信データ: " + JSON.stringify(requestBody));
  var url = PropertiesService.getScriptProperties().getProperty("END_POINT");
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("CHECK_API_KEY");
  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log("Raw Response: " + responseText);
    var responseData = JSON.parse(responseText);
    Logger.log("Parsed JSON: " + JSON.stringify(responseData));
    writeResultsToSpreadsheet(rowIndex, responseData);
  } catch (error) {
    Logger.log("Error: " + error.message);
  }
}
function writeResultsToSpreadsheet(rowIndex, responseData) {
  var sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1");
  var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート2");
  if (!sheet2) {
    sheet2 = SpreadsheetApp.getActiveSpreadsheet().insertSheet("シート2");
  }
  if (responseData.data && responseData.data.outputs.text) {
    var resultText = responseData.data.outputs.text.trim();
    sheet1.getRange(rowIndex, 6).setValue(resultText);
    Logger.log("結果を書き込みました: " + resultText);
    if (resultText === "false") {
      var rowData = sheet1.getRange(rowIndex, 2, 1, 5).getValues()[0];
      sheet2.appendRow(rowData);
      Logger.log(
        "FALSEのデータをシート2に書き込みました: " + JSON.stringify(rowData)
      );
    }
  } else {
    Logger.log("エラー: Difyのレスポンスが不正です");
  }
}
function runWorkflow() {
  var sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1");
  var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート2");
  clearPreviousResults(sheet1, sheet2);
  var data = getSpreadsheetData();
  if (!data) {
    Logger.log("データ取得に失敗しました");
    return;
  }
  var { records, rowIndexes } = data;
  for (var i = 0; i < records.length; i++) {
    var requestBody = prepareRequestData(records[i]);
    if (!requestBody) {
      Logger.log("リクエストデータの作成に失敗しました");
      continue;
    }
    sendDataToDify(requestBody, rowIndexes[i]);
  }
}
function clearPreviousResults(sheet1, sheet2) {
  var lastRow1 = sheet1.getLastRow();
  if (lastRow1 > 1) {
    sheet1.getRange(2, 6, lastRow1 - 1, 1).clearContent();
    Logger.log("シート1の結果をクリアしました");
  }
  if (sheet2) {
    var lastRow2 = sheet2.getLastRow();
    if (lastRow2 > 1) {
      sheet2
        .getRange(2, 1, lastRow2 - 1, sheet2.getLastColumn())
        .clearContent();
      Logger.log("シート2のデータをクリアしました");
    }
  }
}
