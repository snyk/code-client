import { AxiosError, AxiosRequestConfig } from 'axios';

import { BASE_URL } from '../config';
import { ERRORS } from '../constants/errors';
import { RequestTypes } from '../enums/request-types.enum';

import { Agent } from './Agent';
import { IServiceAI } from '../interfaces/service-ai.interface';
import { IConfig } from '../interfaces/config.interface';
import { IHeader, IHeaders } from '../interfaces/http.interface';

import { ErrorResponseDto } from '../dto/error.response.dto';

import { StartSessionRequestDto } from '../dto/start-session.request.dto';
import { StartSessionResponseDto } from '../dto/start-session.response.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { CheckSessionResponseDto } from '../dto/check-session.response.dto';
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

type StartSessionResponse = StartSessionResponseDto | ErrorResponseDto;
type CheckSessionResponse = CheckSessionResponseDto | ErrorResponseDto;
type GetFiltersResponse = GetFiltersResponseDto | ErrorResponseDto;
type CreateBundleResponse = CreateBundleResponseDto | ErrorResponseDto;
type CheckBundleResponse = CheckBundleResponseDto | ErrorResponseDto;
type ExtendBundleResponse = ExtendBundleResponseDto | ErrorResponseDto;
type UploadFilesResponse = UploadFilesResponseDto | ErrorResponseDto;
type GetAnalysisResponse = GetAnalysisResponseDto | ErrorResponseDto;

export class ServiceAI implements IServiceAI {
  private baseURL = BASE_URL;
  private agent = new Agent();

  init(config: IConfig): void {
    this.baseURL = config.baseURL;
    this.agent.init(config);
  }

  getStats(): IConfig {
    return {
      baseURL: this.baseURL,
    } as IConfig;
  }

  getStatusCode(error: AxiosError): number | null {
    if (!error) {
      return null;
    }

    const { response } = error;
    if (!response) {
      return null;
    }

    return response.status || null;
  }

  createErrorResponse(error: AxiosError, type: RequestTypes): ErrorResponseDto {
    const statusCode = this.getStatusCode(error);
    const errorMessages = ERRORS[type];

    const statusText = statusCode ? errorMessages[statusCode] : errorMessages.other;

    return {
      error,
      statusCode,
      statusText,
    } as ErrorResponseDto;
  }

  private createHeaders(sessionToken = '', useContentType = false, isUpload = false): IHeaders {
    const headers = {} as IHeader;

    if (sessionToken) {
      headers['Session-Token'] = sessionToken;
    }

    if (useContentType) {
      headers['Content-Type'] = 'application/json';
      if (isUpload) {
        headers['Content-Type'] = 'application/json;charset=utf-8';
      }
    }

    return {
      headers,
    };
  }

  async startSession(options: StartSessionRequestDto): Promise<StartSessionResponse> {
    const { source } = options;
    const headers = this.createHeaders(undefined, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: '/login',
      method: 'POST',
      data: {
        source,
      },
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(
        new StartSessionResponseDto({
          sessionToken: data.sessionToken,
          loginURL: data.loginURL,
        }),
      );
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.startSession));
    }
  }

  async checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponse> {
    const { sessionToken } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `/session?cache=${Math.random() * 1000000}`,
      method: 'GET',
    };

    try {
      const result = await this.agent.request(config);
      return Promise.resolve(
        new CheckSessionResponseDto({
          isLoggedIn: result.status === 200,
        }),
      );
    } catch (error) {
      const { response } = error;
      if (response && response.status === 304) {
        return Promise.resolve(
          new CheckSessionResponseDto({
            isLoggedIn: false,
          }),
        );
      }

      return Promise.reject(this.createErrorResponse(error, RequestTypes.checkSession));
    }
  }

  async getFilters(options: GetFiltersRequestDto): Promise<GetFiltersResponse> {
    const { sessionToken } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: '/filters',
      method: 'GET',
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new GetFiltersResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.getFilters));
    }
  }

  async createBundle(options: CreateBundleRequestDto): Promise<CreateBundleResponse> {
    const { sessionToken, files } = options;
    const headers = this.createHeaders(sessionToken, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: '/bundle',
      method: 'POST',
      data: {
        files,
      },
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new CreateBundleResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.createBundle));
    }
  }

  async checkBundle(options: CheckBundleRequestDto): Promise<CheckBundleResponse> {
    const { sessionToken, bundleId } = options;
    const headers = this.createHeaders(sessionToken);

    const config: AxiosRequestConfig = {
      ...headers,
      url: `/bundle/${bundleId}`,
      method: 'GET',
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new CheckBundleResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.checkBundle));
    }
  }

  async extendBundle(options: ExtendBundleRequestDto): Promise<ExtendBundleResponse> {
    const { sessionToken, bundleId, files, removedFiles } = options;
    const headers = this.createHeaders(sessionToken, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `/bundle/${bundleId}`,
      method: 'PUT',
      data: {
        files,
        removedFiles,
      },
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new ExtendBundleResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.extendBundle));
    }
  }

  async uploadFiles(options: UploadFilesRequestDto): Promise<UploadFilesResponse> {
    const { sessionToken, bundleId, content } = options;
    const headers = this.createHeaders(sessionToken, true, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `/file/${bundleId}`,
      method: 'POST',
      data: content,
    };

    try {
      await this.agent.request(config);
      return Promise.resolve(new UploadFilesResponseDto({ success: true }));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.uploadFiles));
    }
  }

  async getAnalysis(options: GetAnalysisRequestDto): Promise<GetAnalysisResponse> {
    const { sessionToken, bundleId, useLinters } = options;
    const headers = this.createHeaders(sessionToken);
    const params = useLinters ? { linters: true } : {};
    const config: AxiosRequestConfig = {
      ...headers,
      ...params,
      url: `/analysis/${bundleId}`,
      method: 'GET',
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new GetAnalysisResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.getAnalysis));
    }
  }
}
