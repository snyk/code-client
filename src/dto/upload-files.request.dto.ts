import { IFileContent } from '../interfaces/files.interface';

type UploadFilesRequestDto = {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly content: IFileContent[];
};

export default UploadFilesRequestDto;
