/** 問い合わせURLパターン */
export const CONTACT_URL_PATTERNS = [
  "/contact/",
  "/inquiry/",
  "/sales-contact/",
  "/business-contact/",
  "/contact-us/",
  "/get-in-touch/",
  "/reach-out/",
  "/問い合わせ/",
  "/お問い合わせ/",
] as const;

/** ナビゲーションセレクタパターン */
export const NAVIGATION_SELECTORS = [
  /<nav[\s\S]*?<\/nav>/gi,
  /<[^>]*id=["']menu["'][^>]*>[\s\S]*?<[^>]+>/gi,
  /<footer[\s\S]*?<\/footer>/gi,
  /<ul[^>]*id=["']naviArea["'][^>]*>[\s\S]*<\/ul>/gi,
  /<[^>]*id=["']navigation["'][^>]*>[\s\S]*?<[^>]+>/gi,
  /<[^>]*id=["']nav["'][^>]*>[\s\S]*?<[^>]+>/gi,
  /<div[^>]*class=["'][^'"\\]*\bnav\b[^\"]*["'][^>]*>[\s\S]*<\/div>/gi,
  /<nav[^>]*class=["'][^'"\\]*\bnavigation\b[^\"]*["'][^>]*>[\s\S]*<\/nav>/gi,
  /<ul[^>]*class=["'][^'"\\]*\bmenu\b[^\"]*["'][^>]*>[\s\S]*<\/ul>/gi,
] as const;

/** 無効なページコンテンツパターン */
export const INVALID_PAGE_PATTERNS = [
  "page not found",
  "ページが見つかりません",
  "404 not found",
  "under construction",
  "工事中",
  "site under construction",
  "coming soon",
] as const;

/** アンカーセクション分析用パターン */
export const ANCHOR_SECTION_PATTERNS = [
  (anchorId: string) =>
    new RegExp(
      `<[^>]+id=["']${anchorId}["'][^>]*>[\s\S]*?(?=<[^>]+id=["']|$)`,
      "i",
    ),
  (anchorId: string) =>
    new RegExp(
      `<[^>]+name=["']${anchorId}["'][^>]*>[\s\S]*?(?=<[^>]+name=["']|$)`,
      "i",
    ),
  (anchorId: string) =>
    new RegExp(`<section[^>]*>[\s\S]*?${anchorId}[\s\S]*?<\/section>`, "i"),
] as const;

/** フォームリンクパターン */
export const FORM_LINK_PATTERNS = [
  "form",
  "フォーム",
  "submit",
  "送信",
  "formzu",
  "fc2",
  "google.com/forms",
  "forms.gle",
] as const;

/** フォームテキストパターン */
export const FORM_TEXT_PATTERNS = [
  "フォームはこちら",
  "フォームへ",
  "問い合わせフォーム",
  "入力フォーム",
  "送信フォーム",
  "form here",
  "click here",
  "go to form",
] as const;

/** HTML解析用高優先度問い合わせキーワード */
export const HTML_HIGH_PRIORITY_CONTACT_KEYWORDS = [
  "contact",
  "contact us",
  "contact form",
  "inquiry",
  "enquiry",
  "get in touch",
  "reach out",
  "send message",
  "message us",
  "お問い合わせ",
  "問い合わせ",
  "お問合せ",
  "問合せ",
  "ご相談",
  "相談",
  "お客様窓口",
  "お問い合わせフォーム",
  "お問い合わせはこちら",
  "問い合わせフォーム",
  "form",
  "フォーム",
  "%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B",
  "%E5%95%8F%E5%90%88%E3%81%9B",
  "%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B",
  "%E5%95%8F%E5%90%88%E3%81%9B",
] as const;

/** HTML解析用中優先度問い合わせキーワード */
export const HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS = [
  "form",
  "フォーム",
  "submit",
  "send",
  "mail form",
  "feedback",
] as const;

/** HTML解析用除外キーワード */
export const HTML_EXCLUDED_KEYWORDS = ["download", "recruit", "career"];

/** アンカーセクション分析用問い合わせキーワード */
export const ANCHOR_SECTION_CONTACT_KEYWORDS = [
  "contact",
  "お問い合わせ",
  "問い合わせ",
] as const;

/** フォームリンクのネガティブキーワード */
export const FORM_LINK_NEGATIVE_KEYWORDS = [
  "recruit",
  "career",
  "job",
  "hire",
  "employment",
  "採用",
  "求人",
  "request",
  "download",
  "material",
  "資料",
  "資料請求",
  "brochure",
] as const;
