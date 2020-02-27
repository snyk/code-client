export class AnalyseRequestDto {
  readonly files: string[];
  readonly sessionToken: string;
  readonly useLinters?: boolean;
}
