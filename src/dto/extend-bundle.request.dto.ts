import { IFiles } from '../interfaces/files.interface';

type ExtendBundleRequestDto = {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly files: IFiles;
  readonly removedFiles?: string[];
};

export default ExtendBundleRequestDto;
