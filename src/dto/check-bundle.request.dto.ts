type CheckBundleRequestDto = {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
};

export default CheckBundleRequestDto;
