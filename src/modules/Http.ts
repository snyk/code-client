import { AxiosError, AxiosRequestConfig } from 'axios';

import { ERRORS } from '../constants/errors';
import { RequestTypes } from '../enums/request-types.enum';

import { apiPath } from '../constants/common';
import { Agent } from './Agent';
import { IHeader, IHeaders } from '../interfaces/http.interface';
import {
  StartSessionResponse,
  GetFiltersResponse,
  CreateBundleResponse,
  CheckBundleResponse,
  ExtendBundleResponse,
  UploadFilesResponse,
  GetAnalysisResponse,
  ReportTelemetryResponse,
} from '../interfaces/service-ai.interface';

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
import { ReportTelemetryRequestDto } from '../dto/report-telemetry.request.dto';
import { ReportTelemetryResponseDto } from '../dto/report-telemetry.response.dto';

export class Http {
  private agent = new Agent();

  constructor() {
    this.checkBundle = this.checkBundle.bind(this);
    this.getStatusCode = this.getStatusCode.bind(this);
    this.createErrorResponse = this.createErrorResponse.bind(this);
    this.checkSession = this.checkSession.bind(this);
    this.getAnalysis = this.getAnalysis.bind(this);
    this.uploadFiles = this.uploadFiles.bind(this);
    this.extendBundle = this.extendBundle.bind(this);
    this.createBundle = this.createBundle.bind(this);
    this.getFilters = this.getFilters.bind(this);
    this.startSession = this.startSession.bind(this);
    this.reportError = this.reportError.bind(this);
    this.reportEvent = this.reportEvent.bind(this);
    this.createHeaders = this.createHeaders.bind(this);
  }

  private getStatusCode(error: AxiosError): number | null {
    if (!error) {
      return null;
    }

    const { response } = error;
    if (!response) {
      return null;
    }

    return response.status || null;
  }

  private createErrorResponse(error: AxiosError, type: RequestTypes): ErrorResponseDto {
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

  public async startSession(options: StartSessionRequestDto): Promise<StartSessionResponse> {
    const { source, baseURL } = options;
    const headers = this.createHeaders(undefined, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/login`,
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

  public async checkSession(options: CheckSessionRequestDto): Promise<boolean> {
    const { sessionToken, baseURL } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/session?cache=${Math.random() * 1000000}`,
      method: 'GET',
    };

    try {
      const result = await this.agent.request(config);
      return result.status === 200;
    } catch (error) {
      const { response } = error;
      console.log(' this is the response ', response);
      if (response && [304, 400, 401].includes(response.status)) {
        return false;
      }
      throw error;
    }
  }

  public async getFilters(options: GetFiltersRequestDto): Promise<GetFiltersResponse> {
    const { sessionToken, baseURL } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/filters`,
      method: 'GET',
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new GetFiltersResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.getFilters));
    }
  }

  public async createBundle(options: CreateBundleRequestDto): Promise<CreateBundleResponse> {
    const { baseURL, sessionToken, files } = options;
    const headers = this.createHeaders(sessionToken, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/bundle`,
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

  public async checkBundle(options: CheckBundleRequestDto): Promise<CheckBundleResponse> {
    const { baseURL, sessionToken, bundleId } = options;
    const headers = this.createHeaders(sessionToken);

    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/bundle/${bundleId}`,
      method: 'GET',
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new CheckBundleResponseDto({ ...data, expired: false }));
    } catch (error) {
      return Promise.resolve(this.createErrorResponse(error, RequestTypes.checkBundle));
    }
  }

  public async extendBundle(options: ExtendBundleRequestDto): Promise<ExtendBundleResponse> {
    const { baseURL, sessionToken, bundleId, files, removedFiles } = options;
    const headers = this.createHeaders(sessionToken, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/bundle/${bundleId}`,
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

  public async uploadFiles(options: UploadFilesRequestDto): Promise<UploadFilesResponse> {
    const { baseURL, sessionToken, bundleId, content } = options;
    const headers = this.createHeaders(sessionToken, true, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/file/${bundleId}`,
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

  public async getAnalysis(options: GetAnalysisRequestDto): Promise<GetAnalysisResponse> {
    const { baseURL, sessionToken, bundleId, useLinters } = options;
    const headers = this.createHeaders(sessionToken);
    const params = useLinters ? { linters: true } : {};
    const config: AxiosRequestConfig = {
      ...headers,
      ...params,
      url: `${baseURL}${apiPath}/analysis/${bundleId}`,
      method: 'GET',
    };
    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new GetAnalysisResponseDto(data));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.getAnalysis));
    }
  }

  public async reportError(options: ReportTelemetryRequestDto): Promise<ReportTelemetryResponse> {
    const { baseURL, sessionToken, source, type, message, path, bundleId, version, environmentVersion, data } = options;
    const config: AxiosRequestConfig = {
      url: `${baseURL}${apiPath}/error`,
      method: 'POST',
      data: {
        sessionToken,
        source,
        type,
        message,
        path,
        bundleId,
        version,
        environmentVersion,
        data,
      },
    };

    try {
      await this.agent.request(config);
      return Promise.resolve(new ReportTelemetryResponseDto({}));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.reportError));
    }
  }

  public async reportEvent(options: ReportTelemetryRequestDto): Promise<ReportTelemetryResponse> {
    const { baseURL, sessionToken, source, type, message, path, bundleId, version, environmentVersion, data } = options;
    const config: AxiosRequestConfig = {
      url: `${baseURL}${apiPath}/track`,
      method: 'POST',
      data: {
        sessionToken,
        source,
        type,
        message,
        path,
        bundleId,
        version,
        environmentVersion,
        data,
      },
    };

    try {
      await this.agent.request(config);
      return Promise.resolve(new ReportTelemetryResponseDto({}));
    } catch (error) {
      return Promise.reject(this.createErrorResponse(error, RequestTypes.reportEvent));
    }
  }
}
