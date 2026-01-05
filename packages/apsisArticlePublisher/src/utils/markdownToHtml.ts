/**
 * マークダウン→HTML変換ユーティリティ
 * microCMSリッチエディタのWRITE APIに対応したHTML形式に変換
 * gas-md2html GASライブラリを使用してGitHub Flavored Markdownに完全対応
 */

// gas-md2html GASライブラリのグローバル変数を宣言
declare const MD2html: {
  toHtml: (markdown: string | number | (string | number)[][]) => string;
  toHtml_unsafe: (markdown: string | number | (string | number)[][]) => string;
};

/**
 * マークダウンをHTMLに変換
 * @param markdown マークダウン文字列
 * @returns HTML文字列
 */
export const markdownToHtml = (markdown: string): string => {
  // gas-md2html GASライブラリを使用してMarkdownをHTMLに変換
  // GitHub Flavored Markdownをサポート（テーブル、タスクリスト、打ち消し線、ネストリストなど）
  const html = MD2html.toHtml(markdown);

  return html;
};
