// OAuth再承認トリガー用ユーティリティ
// GASエディタから手動実行し、appsscript.jsonに定義した全スコープのOAuth同意を再取得する

/** appsscript.json記載の全スコープに対してOAuth再承認をトリガーする（読み書き両方） */
export const triggerAuthorizeScopes = (): void => {
	// Drive: 読み取り + 書き込み権限を確認
	const folder = DriveApp.getRootFolder();
	const tempFile = folder.createFile("auth_test.txt", "scope test");
	DriveApp.getFileById(tempFile.getId()).setTrashed(true);
	Logger.log("Drive scope OK (read + write)");

	// Spreadsheet
	SpreadsheetApp.getActiveSpreadsheet();
	Logger.log("Spreadsheet scope OK");

	// External request
	UrlFetchApp.fetch("https://example.com");
	Logger.log("External request scope OK");

	Logger.log("全スコープの承認が完了しました");
};
