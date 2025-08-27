// SNS判定パターン
export const SNS_PATTERNS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'line.me',
  'ameba.jp',
  'note.com',
  'qiita.com'
];

// HTTPステータスコードに対応する詳細エラーメッセージ
export const HTTP_ERROR_MESSAGES: { [key: number]: string } = {
  400: 'Bad Request - 不正なリクエスト',
  401: 'Unauthorized - 認証が必要',
  403: 'Forbidden - アクセス拒否（Bot対策またはアクセス制限）',
  404: 'Not Found - ページが存在しません',
  405: 'Method Not Allowed - 許可されていないHTTPメソッド',
  408: 'Request Timeout - リクエストタイムアウト',
  429: 'Too Many Requests - レート制限（アクセス過多）',
  500: 'Internal Server Error - サーバー内部エラー',
  501: 'Not Implemented - Bot対策によりブロック',
  502: 'Bad Gateway - ゲートウェイエラー',
  503: 'Service Unavailable - サービス利用不可（メンテナンス中）',
  504: 'Gateway Timeout - ゲートウェイタイムアウト',
  520: 'Web Server Error - Webサーバーエラー（Cloudflare）',
  521: 'Web Server Down - Webサーバーダウン（Cloudflare）',
  522: 'Connection Timed Out - 接続タイムアウト（Cloudflare）',
  523: 'Origin Unreachable - オリジンサーバー到達不可（Cloudflare）',
  524: 'A Timeout Occurred - タイムアウト発生（Cloudflare）'
};