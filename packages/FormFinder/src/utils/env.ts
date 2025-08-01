export class Environment {
  private static getProperty(key: string): string {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    if (!value) {
      throw new Error(`Environment variable '${key}' is not set. Please configure it in Script Properties.`);
    }
    return value;
  }

  static get DIFY_API_KEY(): string {
    return this.getProperty('DIFY_API_KEY');
  }

  static get DIFY_ENDPOINT(): string {
    return this.getProperty('DIFY_ENDPOINT');
  }

  static get EXTERNAL_API_ENDPOINT(): string | null {
    try {
      return this.getProperty('EXTERNAL_API_ENDPOINT');
    } catch {
      return null;
    }
  }

  static get SHEET_NAME(): string | null {
    try {
      return this.getProperty('SHEET');
    } catch {
      return null;
    }
  }

  static get LAST_PROCESSED_ROW(): number {
    try {
      const value = this.getProperty('LAST_PROCESSED_ROW');
      return parseInt(value, 10) || 0;
    } catch {
      return 0;
    }
  }

  static setLastProcessedRow(row: number): void {
    PropertiesService.getScriptProperties().setProperty('LAST_PROCESSED_ROW', row.toString());
  }

  static resetProcessingPosition(): void {
    PropertiesService.getScriptProperties().deleteProperty('LAST_PROCESSED_ROW');
  }

  static setupProperties(config: {
    difyApiKey: string;
    difyEndpoint: string;
    externalApiEndpoint?: string;
    sheetName?: string;
  }): void {
    const properties = PropertiesService.getScriptProperties();
    const props: { [key: string]: string } = {
      DIFY_API_KEY: config.difyApiKey,
      DIFY_ENDPOINT: config.difyEndpoint,
    };

    if (config.externalApiEndpoint) {
      props.EXTERNAL_API_ENDPOINT = config.externalApiEndpoint;
    }

    if (config.sheetName) {
      props.SHEET = config.sheetName;
    }

    properties.setProperties(props);
  }

  static isDifyConfigured(): boolean {
    try {
      this.DIFY_API_KEY;
      this.DIFY_ENDPOINT;
      return true;
    } catch {
      return false;
    }
  }
}