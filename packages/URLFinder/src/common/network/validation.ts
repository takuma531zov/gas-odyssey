/**
 * 文字列処理純粋関数群
 * 副作用なし、入力→出力の関数型実装
 */

/**
 * 文字化けデバッグ用ヘルパー
 */
export const toHexString = (str: string): string => {
  try {
    return Array.from(str).map(char =>
      char.charCodeAt(0).toString(16).padStart(2, '0')
    ).join(' ');
  } catch (e) {
    return `[hex conversion error: ${e}]`;
  }
};

/**
 * エンコーディング有効性検証
 */
export const isValidEncoding = (content: string): boolean => {
  // 置換文字の割合が5%未満なら有効
  const replacementChars = (content.match(/�/g) || []).length;
  const isValid = (replacementChars / content.length) < 0.05;
  console.log(`Encoding validation: ${replacementChars} replacement chars out of ${content.length} (${(replacementChars/content.length*100).toFixed(2)}%) - ${isValid ? 'VALID' : 'INVALID'}`);
  return isValid;
};

/**
 * 文字列のハッシュ値を計算（SPA検出用）
 */
export const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
};

/**
 * URLがアンカーリンクかどうかを判定
 */
export const isAnchorLink = (url: string): boolean => url.includes('#');

