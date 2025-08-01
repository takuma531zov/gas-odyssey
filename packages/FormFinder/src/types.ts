export interface FormField {
  name: string;
  type: string;
  id?: string | undefined;
  required: boolean;
  label?: string | undefined;
}

export interface FormStructure {
  formAction: string;
  method: 'POST' | 'GET';
  fields: FormField[];
  submitButton?: string | undefined;
}

export interface CompanyData {
  row: number;
  homepageUrl: string;
  contactFormUrl?: string;
  formStructure?: FormStructure;
}

export interface DifyApiResponse {
  answer: string;
  conversation_id?: string;
  message_id?: string;
}

export interface ProcessingResult {
  success: boolean;
  contactFormUrl?: string;
  formStructure?: FormStructure;
  error?: string;
}

export interface ScrapingConfig {
  timeout: number;
  retryCount: number;
  userAgent: string;
}

export interface ApiConfig {
  difyApiKey: string;
  difyEndpoint: string;
  externalApiEndpoint?: string;
}