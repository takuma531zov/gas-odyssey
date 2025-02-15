/**
 * 現在日時を取得
 * @returns
 */
export const getCurrentDate = () => {
  const date = new Date();
  return Utilities.formatDate(date, "JST", "yyyy/MM/dd HH:mm:ss");
};
