// Chrome Extension API types

export interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
}

export interface ProblemInfo {
  title: string;
  description: string;
  code?: string;
}

export interface ContentScriptResponse {
  success: boolean;
  data?: ProblemInfo;
  error?: string;
}

export interface AssistanceRequest {
  problem_name: string;
  code_so_far: string;
  language: string;
  mode: 'next_code' | 'hint';
}

export interface AssistanceResponse {
  success: boolean;
  response?: string;
  detail?: string;
}

export type ExtensionMode = 'next_code' | 'hint';
export type ProgrammingLanguage = 'python' | 'javascript' | 'java' | 'cpp' | 'c' | 'csharp' | 'go' | 'typescript'; 