import { IFiles } from '../interfaces/files.interface';

type CreateBundleRequestDto = {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly files: IFiles;
};

export default CreateBundleRequestDto;
