export default class AnalyseRequestDto {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly useLinters?: boolean;
  readonly baseDir: string;
  readonly files: string[];
  readonly removedFiles: string[];
}
