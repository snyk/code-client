type CreateBundleResponseDto = {
  readonly bundleId: string;
  readonly missingFiles?: string[];
  readonly uploadURL?: string;
};

export default CreateBundleResponseDto;
