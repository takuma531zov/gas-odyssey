export type FetchOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;
// biome-ignore lint/suspicious/noExplicitAny: 外部APIの型が不明なため any を許容
type ResponseData = any;

/**
 * 現在日時を取得
 * @returns
 */
export const getCurrentDate = () =>
  Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

/**
 * 現在の月を日本時間で取得
 * 例: 1月なら1を返す
 */
export const getCurrentMonth = () => {
  const today = new Date();
  const jstDate = new Date(today.getTime() + 9 * 60 * 60 * 1000); // UTC+9時間で日本時間に変換
  return jstDate.getMonth() + 1;
};

/**
 * APIを呼び出すための関数
 * @param url
 * @param options
 * @returns
 */
export const fetchData = (
  url: string,
  options: FetchOptions,
): {
  responseData: ResponseData;
  statusCode: number;
} => {
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());

    if (statusCode === 200 || statusCode === 201) {
      Logger.log(`Success: ${responseData}`);
    } else {
      Logger.log(`Error (${statusCode}): ${responseData}`);
    }
    return { responseData, statusCode };
  } catch (error) {
    Logger.log(`Failure: ${error}`);
    return { responseData: null, statusCode: 500 };
  }
};
