export class AnalyseRequestDto {
  readonly files: string[];
  readonly removedFiles: string[];
  readonly sessionToken: string;
  readonly useLinters?: boolean;
}
