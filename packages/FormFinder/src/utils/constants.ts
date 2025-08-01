// 優先度順キーワード群（高頻度→低頻度）
export const CONTACT_KEYWORDS = [
  // 最高頻度（ほぼ確実にヒット）
  'contact',
  'inquiry',

  // 高頻度
  'form',
  'otoiawase',

  // 中頻度
  'contactus',
  'toiawase',

  // 低頻度（削除候補）
  // 'contacts',
  // 'mailform',
'%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B',
 '%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B'
];

export const SPREADSHEET_COLUMNS = {
  HOMEPAGE_URL: 'L',       // 企業ホームページURL（入力済み）
  CONTACT_FORM_URL: 'AP',  // 問い合わせフォームURL（出力先）
  FORM_STRUCTURE: 'AS',    // フォーム構造データ（JSON形式で出力）
  ERROR_STATUS: 'AT'       // ステータス（エラー時の状況出力）
} as const;

// Googleフォーム検出パターン
export const GOOGLE_FORM_DOMAINS = [
  'forms.google.com',
  'docs.google.com/forms',
  'forms.gle',
  'goo.gl/forms'
] as const;

// =====================================================
// 正規表現パターン（事前コンパイル済み）
// =====================================================

/**
 * Googleフォーム検出用の事前コンパイル済み正規表現
 * パフォーマンス向上のため、実行時ではなく初期化時にコンパイル
 */
export const GOOGLE_FORM_REGEX_PATTERNS = [
  /https:\/\/docs\.google\.com\/forms\/d\/[^"'\s<>]+/gi,
  /https:\/\/forms\.google\.com\/[^"'\s<>]+/gi,
  /https:\/\/forms\.gle\/[^"'\s<>]+/gi,
  /https?:\/\/goo\.gl\/forms\/[^"'\s<>]+/gi  // goo.gl短縮URL対応
] as const;

/**
 * フォーム要素抽出用の事前コンパイル済み正規表現
 */
export const FORM_PARSING_REGEX = {
  // フォーム全体を抽出
  FORM_ELEMENT: /<form[^>]*>[\s\S]*?<\/form>/gi,
  
  // フォーム内の要素を抽出
  INPUT_FIELDS: /<(input|textarea|select)[^>]*>/gi,
  INPUT_ELEMENT: /<input[^>]*>/gi,
  TEXTAREA_ELEMENT: /<textarea[^>]*>[\s\S]*?<\/textarea>/gi,
  SELECT_ELEMENT: /<select[^>]*>[\s\S]*?<\/select>/gi,
  
  // 属性値を抽出
  ACTION_ATTR: /action\s*=\s*["']([^"']*)/i,
  METHOD_ATTR: /method\s*=\s*["']([^"']*)/i,
  NAME_ATTR: /name\s*=\s*["']([^"']*)/i,
  TYPE_ATTR: /type\s*=\s*["']([^"']*)/i,
  ID_ATTR: /id\s*=\s*["']([^"']*)/i,
  REQUIRED_ATTR: /required/i,
  VALUE_ATTR: /value\s*=\s*["']([^"']*)/i,
  
  // Submit button検出
  SUBMIT_BUTTONS: [
    /<input[^>]*type\s*=\s*["']submit["'][^>]*value\s*=\s*["']([^"']*)["']/i,
    /<input[^>]*value\s*=\s*["']([^"']*)["'][^>]*type\s*=\s*["']submit["']/i,
    /<button[^>]*type\s*=\s*["']submit["'][^>]*>([^<]*)</i,
    /<button[^>]*>([^<]*)<\/button>/i
  ]
} as const;

export const DEFAULT_CONFIG = {
  TIMEOUT: 20000,      // 30秒→20秒に短縮
  RETRY_COUNT: 0,      // リトライなし（1→0）
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  BATCH_SIZE: 1,       // 新仕様: 1行ずつ処理
  MAX_PROCESSING_ROWS: 20  // 一度に処理する最大行数（デフォルト10件）
} as const;

// =====================================================
// レート制限・待機時間設定
// =====================================================

/**
 * 動的な待機時間設定
 * 処理状況に応じて待機時間を調整し、パフォーマンスを最適化
 */
export const RATE_LIMIT_CONFIG = {
  // Step2でのキーワードURL試行間の待機時間
  KEYWORD_ACCESS_DELAY: 100,  // 100ms（従来500ms→大幅短縮）
  
  // 企業間処理の待機時間
  COMPANY_PROCESSING_DELAY: 500,  // 500ms（従来と同じ）
  
  // Step5での複数GoogleForm処理間の待機時間
  GOOGLE_FORM_PROCESSING_DELAY: 300,  // 300ms（従来500ms→短縮）
  
  // 最小待機時間（高速処理時）
  MIN_DELAY: 50,  // 50ms
  
  // 最大待機時間（エラー発生時など）
  MAX_DELAY: 1000  // 1000ms
} as const;
