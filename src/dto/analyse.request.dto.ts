export class AnalyseRequestDto {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly useLinters?: boolean;
  readonly files: string[];
  readonly removedFiles: string[];
}
