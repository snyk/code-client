import ErrorResponseDto from '../dto/error.response.dto';

import StartSessionRequestDto from '../dto/start-session.request.dto';
import StartSessionResponseDto from '../dto/start-session.response.dto';
import CheckSessionRequestDto from '../dto/check-session.request.dto';
import GetFiltersRequestDto from '../dto/get-filters.request.dto';
import GetFiltersResponseDto from '../dto/get-filters.response.dto';
import CreateBundleRequestDto from '../dto/create-bundle.request.dto';
import CreateBundleResponseDto from '../dto/create-bundle.response.dto';
import CheckBundleRequestDto from '../dto/check-bundle.request.dto';
import CheckBundleResponseDto from '../dto/check-bundle.response.dto';
import UploadFilesRequestDto from '../dto/upload-files.request.dto';
import GetAnalysisRequestDto from '../dto/get-analysis.request.dto';
import { GetAnalysisResponseDto } from '../dto/get-analysis.response.dto';
import ReportTelemetryRequestDto from '../dto/report-telemetry.request.dto';
import AnalyseRequestDto from '../dto/analyse.request.dto';

type ResultSuccess<T> = { type: 'success'; value: T };
type ResultError = { type: 'error'; error: ErrorResponseDto };

export type IResult<T> = ResultSuccess<T> | ResultError;

export interface IServiceAI {
  /**
   * Requests the creation of a new login session
   * @param options
   */
  startSession(options: StartSessionRequestDto): Promise<IResult<StartSessionResponseDto>>;

  /**
   * Checks status of the login process
   * @param options
   */
  checkSession(options: CheckSessionRequestDto): Promise<IResult<boolean>>;

  /**
   * Requests current filtering options for uploaded bundles
   * @param options
   */
  getFilters(options: GetFiltersRequestDto): Promise<IResult<GetFiltersResponseDto>>;

  /**
   * Creates a new bundle
   * @param options
   */
  createBundle(options: CreateBundleRequestDto): Promise<IResult<CreateBundleResponseDto>>;

  /**
   * Checks the status of a bundle
   * @param options
   */
  checkBundle(options: CheckBundleRequestDto): Promise<IResult<CheckBundleResponseDto>>;

  /**
   * Uploads missing files to a bundle
   * @param options
   */
  uploadFiles(options: UploadFilesRequestDto): Promise<IResult<boolean>>;

  /**
   * Starts a new bundle analysis or checks its current status and available results
   * @param options
   */
  getAnalysis(options: GetAnalysisRequestDto): Promise<IResult<GetAnalysisResponseDto>>;

  /**
   * Reports an error
   * @param options
   */
  reportError(options: ReportTelemetryRequestDto): Promise<IResult<void>>;

  /**
   * Reports an event
   * @param options
   */
  reportEvent(options: ReportTelemetryRequestDto): Promise<IResult<void>>;

  /**
   * Reports an event
   * @param options
   */
  analyse(options: AnalyseRequestDto): Promise<void>;

  /**
   * Event emitters
   */
  on(eventName: string, callback: Function, ...args: any[]): void;
  emit(eventName: string, ...args: any[]): void;
  removeListeners(): void;
}
