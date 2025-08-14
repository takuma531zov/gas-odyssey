/**
 * 問い合わせページ検索用定数
 * 元のContactPageFinderクラスから分離（ロジック変更なし）
 */

// URL推測専用パターン（URL推測でテストするパス）
export const HIGH_PRIORITY_PATTERNS = [

  '/contact/', '/contact',  '/contact.php', '/inquiry/','/inquiry', '/inquiry.php',  '/form','/form/',  '/form.php','/contact-us/', '/contact-us',
  '/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // お問い合わせ
  '/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/', // 問い合わせ

];

// BtoB問い合わせ特化：純粋な問い合わせキーワードのみ
export const HIGH_PRIORITY_CONTACT_KEYWORDS = [
  // 直接的問い合わせ（最高優先度）
  'contact', 'contact us', 'contact form', 'inquiry', 'enquiry',
  'get in touch', 'reach out', 'send message', 'message us',
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
  'ご相談', '相談', 'お客様窓口', 'お問い合わせフォーム',
  'お問い合わせはこちら', '問い合わせフォーム',
  // フォーム関連を追加
  'form', 'フォーム',
  // URL内検索用（日本語エンコード版）
  '%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // お問い合わせ
  '%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // 問い合わせ
  '%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B', // お問合せ
  '%E5%95%8F%E5%90%88%E3%81%9B' // 問合せ
];

// 間接的問い合わせ（中優先度） - 営業系削除済み
export const MEDIUM_PRIORITY_CONTACT_KEYWORDS = [
  'form', 'フォーム', 'submit', 'send', 'mail form',
  'feedback'
];

// 精度の妨げになる明確な除外キーワードのみ（最小限）
export const EXCLUDED_KEYWORDS = [
  'download', 'recruit', 'career'
];

// 送信系ボタンキーワード（BtoB問い合わせ特化）
export const SUBMIT_BUTTON_KEYWORDS = [
  // 基本送信キーワード
  '送信', '送る', 'submit', 'send',

  // 問い合わせ関連のみ（営業系削除）
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
  'ご相談', '相談', 'contact', 'inquiry'
];

// フォーム関連キーワード
export const FORM_KEYWORDS = [
  'フォーム', 'form', '入力', '送信',
  'googleフォーム', 'google form', 'submit'
];