/**
 * フォーム関連の定数定義（統合版）
 * form_keywords.tsの内容も含む
 */

// 送信ボタン関連キーワード
export const SUBMIT_BUTTON_KEYWORDS = [
  "送信",
  "送る",
  "submit",
  "send",
  "お問い合わせ",
  "問い合わせ",
  "お問合せ",
  "問合せ",
  "ご相談",
  "相談",
  "contact",
  "inquiry",
] as const;

// reCAPTCHAパターン（統一版）
export const RECAPTCHA_PATTERNS = [
  /https:\/\/www\.google\.com\/recaptcha\/api\.js/gi,
  /recaptcha\/api\.js/gi,
  /<div[^>]*class=["|'][^"|']*g-recaptcha[^"|']*["|']/gi,
  /<div[^>]*id=["|'][^"|']*recaptcha[^"|']*["|']/gi,
  /data-sitekey=["|'][^"|']*["|']/gi,
  /私はロボットではありません/gi,
  /I'm not a robot/gi,
  /reCAPTCHA/gi,
] as const;

// フォーム要素キーワード
// 説明用途（表示向け）の代表語に限定
export const FORM_ELEMENT_KEYWORDS = [
  "<input",
  "<textarea",
  "<select",
  'type="text"',
  'type="email"',
  'type="tel"',
] as const;

// コンタクトキーワード
// 説明用途（表示向け）の代表語に限定
export const CONTACT_KEYWORDS = [
  "お問い合わせ",
  "問い合わせ",
  "contact",
  "inquiry",
] as const;

// コンタクトフィールドパターン
// 説明用途（表示向け）の代表パターンに限定（主要4項目）
export const CONTACT_FIELD_PATTERNS = [
  'name="(?:.*(?:name|名前|氏名))"',
  'name="(?:.*(?:email|メール))"',
  'name="(?:.*(?:phone|電話|tel))"',
  'name="(?:.*(?:message|メッセージ|質問|問い合わせ|inquiry))"',
];

// 送信ボタンパターン
export const SUBMIT_BUTTON_PATTERNS = [
  /<input[^>]*type=["|']submit["|'][^>]*>/gis,
  /<input[^>]*type=["|']image["|'][^>]*>/gis,
  /<button[^>]*type=["|']submit["|'][\s\S]*?<\/button>/gis,
  /<button(?![^>]*type=)[^>]*>[\s\S]*?<\/button>/gis,
];

// Googleフォームパターン(HTMLタグ（a/iframe）レベルで「Googleフォームが埋め込まれている or リンクされているか」を検出・分類するための正規表現)
export const GOOGLE_FORMS_PATTERNS = [
  /<a[^>]*href=["|']([^\"]*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)]*)["|'][^>]*>/gi,
  /<iframe[^>]*src=["|']([^\"]*docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)]*)["|'][^>]*>/gi,
];

// GoogleフォームURLパターン(HTMLテキスト全体から「GoogleフォームのURL文字列そのもの」を抽出するための正規表現)
export const GOOGLE_FORM_URL_PATTERNS = [
  /https?:\/\/docs\.google\.com\/forms\/d\/[a-zA-Z0-9-_]+\/?[^"'\s\)]+/gi,
  /https?:\/\/forms\.gle\/[^"'\s\)]+/gi,
  /https?:\/\/goo\.gl\/forms\/[^"'\s\)]+/gi,
];

// 埋め込みフォーム連絡先フィールドキーワード（form_keywords.tsから移動）
export const EMBEDDED_FORM_CONTACT_FIELD_KEYWORDS = [
  "御社名",
  "お名前",
  "メールアドレス",
  "電話番号",
  "ご質問",
  "company",
  "name",
  "email",
  "phone",
  "message",
  "inquiry",
  "会社名",
  "名前",
  "メール",
  "問い合わせ",
  "質問",
  "送信",
  "submit",
  "送る",
  "send",
  "確認",
  "confirm",
] as const;

// フォーム除外アクションパターン（form_keywords.tsから移動）
export const FORM_EXCLUDE_ACTIONS = [
  "/search",
  "/filter",
  "/sort",
  "?search",
  "?q=",
  "?query=",
  "/newsletter",
  "/subscribe",
  "/download",
  "/signup",
  "/login",
  "/register",
  "/member",
  "/formresponse",
  "formresponse",
] as const;

// フォーム除外コンテキストキーワード（form_keywords.tsから移動）
export const FORM_EXCLUDE_CONTEXT_KEYWORDS = [
  "newsletter",
  "subscribe",
  "メルマガ",
  "ニュースレター",
  "download",
  "ダウンロード",
  "資料請求",
  "資料ダウンロード",
  "survey",
  "questionnaire",
  "アンケート",
  "feedback",
  "search",
  "filter",
  "検索",
  "フィルター",
] as const;

// フォーム除外キーワード - 検索関連（form_keywords.tsから移動）
export const FORM_EXCLUDE_SEARCH_KEYWORDS = [
  "search",
  "filter",
  "sort",
  "検索",
  "フィルター",
  "ソート",
  "find",
  "query",
] as const;

// フォームコンテキスト問い合わせキーワード（form_keywords.tsから移動）
export const FORM_CONTEXT_CONTACT_KEYWORDS = [
  "contact",
  "inquiry",
  "お問い合わせ",
  "問い合わせ",
  "ご相談",
] as const;

// Googleフォーム除外キーワード（form_keywords.tsから移動）
export const GOOGLE_FORM_EXCLUDE_KEYWORDS = [
  "ライター",
  "writer",
  "募集",
  "recruit",
  "recruitment",
  "career",
  "job",
  "hire",
  "employment",
  "採用",
  "求人",
  "応募",
  "apply",
  "application",
  "資料請求",
  "download",
  "material",
  "brochure",
  "request",
  "アンケート",
  "survey",
  "questionnaire",
  "セミナー",
  "seminar",
  "webinar",
  "event",
  "workshop",
  "メルマガ",
  "newsletter",
  "subscription",
  "subscribe",
] as const;

// Googleフォームコンタクトキーワード（form_keywords.tsから移動）
export const GOOGLE_FORM_CONTACT_KEYWORDS = [
  "お問い合わせ",
  "問い合わせ",
  "お問合せ",
  "問合せ",
  "contact",
  "inquiry",
  "ご相談",
  "相談",
  "support",
  "business inquiry",
  "general inquiry",
] as const;
