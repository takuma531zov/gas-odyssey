// URLパターン戦略で使用される高優先度パターン
export const HIGH_PRIORITY_PATTERNS: readonly string[] = [
  "/contact/",
  "/contact",
  "/contact.php",
  "/inquiry/",
  "/inquiry",
  "/inquiry.php",
  "/form",
  "/form/",
  "/form.php",
  "/contact-us/",
  "/contact-us",
  "/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/", // お問い合わせ
  "/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/", // 問い合わせ
] as const;

// 高信頼度パターン（NetworkUtilsから移動）
export const HIGH_CONFIDENCE_PATTERNS: readonly string[] = [
  "/contact/",
  "/contact",
  "/inquiry/",
  "/inquiry",
] as const;

// 中信頼度パターン（NetworkUtilsから移動）
export const MEDIUM_CONFIDENCE_PATTERNS: readonly string[] = [
  "/form/",
  "/form",
] as const;
