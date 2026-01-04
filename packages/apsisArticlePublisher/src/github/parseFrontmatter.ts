/**
 * フロントマター解析
 * マークダウンファイルからフロントマターを抽出・解析
 */

import { logInfo, logWarn } from "../utils/logger";
import type { FrontMatter, ParsedMarkdown } from "../types";

/**
 * フロントマターを解析
 * @param markdown マークダウン文字列
 * @returns パース済みマークダウン
 */
export const parseFrontmatter = (markdown: string): ParsedMarkdown => {
  // フロントマターの抽出（--- で囲まれた部分）
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error("フロントマターが見つかりません");
  }

  const frontmatterText = frontmatterMatch[1];
  const content = frontmatterMatch[2];

  // フロントマターのパース
  const frontMatter = parseFrontmatterText(frontmatterText);

  // 必須フィールドのチェック
  if (!frontMatter.title) {
    throw new Error("フロントマターにtitleが見つかりません");
  }

  if (!frontMatter.author) {
    throw new Error("フロントマターにauthorが見つかりません");
  }

  logInfo("フロントマターを解析しました", {
    title: frontMatter.title,
    author: frontMatter.author,
    tags: frontMatter.tags,
    read_time: frontMatter.read_time,
  });

  return {
    frontMatter,
    content,
  };
};

/**
 * フロントマターテキストをパース
 * 簡易的なYAML風パーサー
 */
const parseFrontmatterText = (text: string): FrontMatter => {
  const lines = text.split("\n");
  const frontMatter: Partial<FrontMatter> = {
    tags: [], // デフォルト値
    read_time: "3分", // デフォルト値
  };

  let currentKey: string | null = null;
  let arrayValues: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行はスキップ
    if (!trimmed) continue;

    // 配列要素（- item）
    if (trimmed.startsWith("- ")) {
      const value = trimmed.substring(2).trim();
      arrayValues.push(value);
      continue;
    }

    // キー: 値 形式
    const keyValueMatch = trimmed.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (keyValueMatch) {
      // 前の配列を保存
      if (currentKey && arrayValues.length > 0) {
        if (currentKey === "tags") {
          frontMatter.tags = arrayValues;
        }
        arrayValues = [];
      }

      const key = keyValueMatch[1];
      const value = keyValueMatch[2].trim();

      currentKey = key;

      // 値が設定されている場合
      if (value) {
        switch (key) {
          case "title":
            frontMatter.title = value;
            break;
          case "author":
            frontMatter.author = value;
            break;
          case "read_time":
            // 値が空でない場合のみ設定
            if (value) {
              // 数値のみの場合は「分」を付与（例: "5" → "5分"）
              // 既に「分」が含まれている場合はそのまま
              const cleanValue = value.replace(/^["']|["']$/g, ""); // クォート除去
              frontMatter.read_time = /^\d+$/.test(cleanValue)
                ? `${cleanValue}分`
                : cleanValue;
            }
            break;
          case "status":
            frontMatter.status = value;
            break;
          case "excerpt":
            frontMatter.excerpt = value;
            break;
          case "tags":
            // タグが1行で定義されている場合（tags: [tag1, tag2]）
            if (value.startsWith("[") && value.endsWith("]")) {
              const tagsStr = value.substring(1, value.length - 1);
              frontMatter.tags = tagsStr
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t);
            }
            break;
        }
      }
    }
  }

  // 最後の配列を保存
  if (currentKey && arrayValues.length > 0) {
    if (currentKey === "tags") {
      frontMatter.tags = arrayValues;
    }
  }

  // デフォルト値の適用
  if (!frontMatter.tags || frontMatter.tags.length === 0) {
    logWarn("tagsが設定されていません。空配列を使用します");
    frontMatter.tags = [];
  }

  return frontMatter as FrontMatter;
};
