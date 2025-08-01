export class Logger {
  private static prefix = '[FormFinder]';
  
  // デバッグレベルの定義
  private static readonly LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  // 現在のログレベルを取得（デフォルト: INFO）
  private static getCurrentLogLevel(): number {
    try {
      const level = PropertiesService.getScriptProperties().getProperty('LOG_LEVEL');
      switch (level?.toUpperCase()) {
        case 'ERROR': return this.LOG_LEVELS.ERROR;
        case 'WARN': return this.LOG_LEVELS.WARN;
        case 'INFO': return this.LOG_LEVELS.INFO;
        case 'DEBUG': return this.LOG_LEVELS.DEBUG;
        default: return this.LOG_LEVELS.INFO; // デフォルト
      }
    } catch {
      return this.LOG_LEVELS.INFO; // エラー時はINFOレベル
    }
  }

  static info(message: string, ...args: any[]): void {
    if (this.getCurrentLogLevel() >= this.LOG_LEVELS.INFO) {
      console.log(`${this.prefix} INFO: ${message}`, ...args);
    }
  }

  static error(message: string, error?: any): void {
    if (this.getCurrentLogLevel() >= this.LOG_LEVELS.ERROR) {
      console.error(`${this.prefix} ERROR: ${message}`, error);
    }
  }

  static debug(message: string, ...args: any[]): void {
    if (this.getCurrentLogLevel() >= this.LOG_LEVELS.DEBUG) {
      console.log(`${this.prefix} DEBUG: ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.getCurrentLogLevel() >= this.LOG_LEVELS.WARN) {
      console.warn(`${this.prefix} WARN: ${message}`, ...args);
    }
  }

  // ログレベル設定用のヘルパーメソッド
  static setLogLevel(level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'): void {
    PropertiesService.getScriptProperties().setProperty('LOG_LEVEL', level);
    console.log(`${this.prefix} ログレベルを ${level} に設定しました`);
  }

  // 現在のログレベルを確認
  static getLogLevel(): string {
    const currentLevel = this.getCurrentLogLevel();
    const levelNames = Object.keys(this.LOG_LEVELS);
    return levelNames.find(name => this.LOG_LEVELS[name as keyof typeof this.LOG_LEVELS] === currentLevel) || 'INFO';
  }
}