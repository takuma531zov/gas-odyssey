export type DifyPayloadType = {
  inputs: {
    info: string;
  };
};

type DifyApiResponse = {
  data: {
    created_at: number;
    elapsed_time: number;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    error: any;
    finished_at: number;
    id: string;
    outputs: {
      result: string;
    };
    status: string;
    total_steps: number;
    total_tokens: number;
    workflow_id: string;
  };
  task_id: string;
  workflow_run_id: string;
};

// Difyリクエストのオプションを設定
const getOptions = (
  payloadInput: DifyPayloadType,
  apiKey: string,
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions => {
  // リクエストのペイロード
  const payload = {
    ...payloadInput,
    response_mode: "blocking",
    user: "abc-123", // ユーザーIDなど適切な値を設定
  };

  return {
    method: "post",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(payload),
  };
};

/**
 * Dify を呼び出すための関数
 * @param row
 * @param apiKey
 * @returns
 */
export const executeDifyWorkFlow = (
  payload: DifyPayloadType,
  apiKey: string,
  url: string,
): string | null | undefined => {
  const options = getOptions(payload, apiKey);

  try {
    // HTTPリクエストの送信
    const response = UrlFetchApp.fetch(url, options);

    // レスポンスの処理
    const responseData: DifyApiResponse = JSON.parse(response.getContentText());

    Logger.log(`Response: ${JSON.stringify(responseData)}`);
    return responseData.data.outputs.result; // 必要に応じて結果を利用

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } catch (error: any) {
    Logger.log(`Error: ${error.message}`);
    throw new Error(`Failed to run the workflow: ${error.message}`);
  }
};
