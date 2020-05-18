import { ErrorResponseDto } from '../dto/error.response.dto';

import { StartSessionRequestDto } from '../dto/start-session.request.dto';
import { StartSessionResponseDto } from '../dto/start-session.response.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { GetFiltersRequestDto } from '../dto/get-filters.request.dto';
import { GetFiltersResponseDto } from '../dto/get-filters.response.dto';
import { CreateBundleRequestDto } from '../dto/create-bundle.request.dto';
import { CreateBundleResponseDto } from '../dto/create-bundle.response.dto';
import { CheckBundleRequestDto } from '../dto/check-bundle.request.dto';
import { CheckBundleResponseDto } from '../dto/check-bundle.response.dto';
import { ExtendBundleRequestDto } from '../dto/extend-bundle.request.dto';
import { ExtendBundleResponseDto } from '../dto/extend-bundle.response.dto';
import { UploadFilesRequestDto } from '../dto/upload-files.request.dto';
import { UploadFilesResponseDto } from '../dto/upload-files.response.dto';
import { GetAnalysisRequestDto } from '../dto/get-analysis.request.dto';
import { GetAnalysisResponseDto } from '../dto/get-analysis.response.dto';

export type StartSessionResponse = StartSessionResponseDto | ErrorResponseDto;
export type GetFiltersResponse = GetFiltersResponseDto | ErrorResponseDto;
export type CreateBundleResponse = CreateBundleResponseDto | ErrorResponseDto;
export type CheckBundleResponse = CheckBundleResponseDto | ErrorResponseDto;
export type ExtendBundleResponse = ExtendBundleResponseDto | ErrorResponseDto;
export type UploadFilesResponse = UploadFilesResponseDto | ErrorResponseDto;
export type GetAnalysisResponse = GetAnalysisResponseDto | ErrorResponseDto;

export interface IServiceAI {
  /**
   * Requests the creation of a new login session
   * @param options
   */
  startSession(options: StartSessionRequestDto): Promise<StartSessionResponse>;

  /**
   * Checks status of the login process
   * @param options
   */
  checkSession(options: CheckSessionRequestDto): Promise<boolean>;

  /**
   * Requests current filtering options for uploaded bundles
   * @param options
   */
  getFilters(options: GetFiltersRequestDto): Promise<GetFiltersResponse>;

  /**
   * Creates a new bundle
   * @param options
   */
  createBundle(options: CreateBundleRequestDto): Promise<CreateBundleResponse>;

  /**
   * Checks the status of a bundle
   * @param options
   */
  checkBundle(options: CheckBundleRequestDto): Promise<CheckBundleResponse>;

  /**
   * Creates a new bundle based on a previously uploaded one
   * @param options
   */
  extendBundle(options: ExtendBundleRequestDto): Promise<ExtendBundleResponse>;

  /**
   * Uploads missing files to a bundle
   * @param options
   */
  uploadFiles(options: UploadFilesRequestDto): Promise<UploadFilesResponse>;

  /**
   * Starts a new bundle analysis or checks its current status and available results
   * @param options
   */
  getAnalysis(options: GetAnalysisRequestDto): Promise<GetAnalysisResponse>;
}
