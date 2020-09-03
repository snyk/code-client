type GetAnalysisRequestDto = {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly useLinters?: boolean;
};

export default GetAnalysisRequestDto;
