import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import { ERRORS, RequestTypes } from '../constants/errors';

import { apiPath } from '../constants/common';
import axios from './axios';
import { IHeader, IHeaders, IResult, ErrorResponseDto } from '../interfaces/http.interface';

import { IFiles, ISupportedFiles } from '../interfaces/files.interface';

import StartSessionResponseDto from '../dto/start-session.response.dto';
import CreateBundleResponseDto from '../dto/create-bundle.response.dto';
import CheckBundleResponseDto from '../dto/check-bundle.response.dto';
import ExtendBundleResponseDto from '../dto/extend-bundle.response.dto';
import UploadFilesRequestDto from '../dto/upload-files.request.dto';
import { GetAnalysisResponseDto } from '../dto/get-analysis.response.dto';
import ReportTelemetryRequestDto from '../dto/report-telemetry.request.dto';

export default class Http {
  // eslint-disable-next-line class-methods-use-this
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

    const statusText: string = statusCode ? errorMessages[statusCode] : errorMessages.other;

    return {
      statusCode,
      statusText,
    };
  }

  // eslint-disable-next-line class-methods-use-this
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

  public async startSession(options: {
    readonly baseURL: string;
    readonly source: string;
  }): Promise<IResult<StartSessionResponseDto>> {
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
      const response = await axios.request<StartSessionResponseDto>(config);
      return { type: 'success', value: response.data };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.startSession) };
    }
  }

  public async checkSession(options: {
    readonly baseURL: string;
    readonly sessionToken: string;
  }): Promise<IResult<boolean>> {
    const { sessionToken, baseURL } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/session?cache=${Math.random() * 1000000}`,
      method: 'GET',
    };

    return axios
      .request(config)
      .catch((err: AxiosError) => {
        if (err.response && [304, 400, 401].includes(err.response.status)) {
          return { type: 'success', value: false };
        }
        return { type: 'error', error: this.createErrorResponse(err, RequestTypes.checkSession) };
      })
      .then((response: AxiosResponse) => {
        return { type: 'success', value: response.status === 200 };
      });
  }

  public async getFilters(options: {
    readonly baseURL: string;
    readonly sessionToken: string;
  }): Promise<IResult<ISupportedFiles>> {
    const { sessionToken, baseURL } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/filters`,
      method: 'GET',
    };

    try {
      const response = await axios.request<ISupportedFiles>(config);
      return { type: 'success', value: response.data };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.getFilters) };
    }
  }

  public async createBundle(options: {
    readonly baseURL: string;
    readonly sessionToken: string;
    readonly files: IFiles;
  }): Promise<IResult<CreateBundleResponseDto>> {
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
      const response = await axios.request<CreateBundleResponseDto>(config);
      return { type: 'success', value: response.data };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.createBundle) };
    }
  }

  public async checkBundle(options: {
    readonly baseURL: string;
    readonly sessionToken: string;
    readonly bundleId: string;
  }): Promise<IResult<CheckBundleResponseDto>> {
    const { baseURL, sessionToken, bundleId } = options;
    const headers = this.createHeaders(sessionToken);

    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/bundle/${bundleId}`,
      method: 'GET',
    };

    try {
      const response = await axios.request<CheckBundleResponseDto>(config);
      return { type: 'success', value: response.data };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.checkBundle) };
    }
  }

  public async extendBundle(options: {
    readonly baseURL: string;
    readonly sessionToken: string;
    readonly bundleId: string;
    readonly files: IFiles;
    readonly removedFiles?: string[];
  }): Promise<IResult<ExtendBundleResponseDto>> {
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
      const response = await axios.request<ExtendBundleResponseDto>(config);
      return { type: 'success', value: response.data };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.extendBundle) };
    }
  }

  public async uploadFiles(options: UploadFilesRequestDto): Promise<IResult<boolean>> {
    const { baseURL, sessionToken, bundleId, content } = options;
    const headers = this.createHeaders(sessionToken, true, true);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `${baseURL}${apiPath}/file/${bundleId}`,
      method: 'POST',
      data: content,
    };

    try {
      await axios.request(config);
      return { type: 'success', value: true };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.uploadFiles) };
    }
  }

  public async getAnalysis(options: {
    readonly baseURL: string;
    readonly sessionToken: string;
    readonly bundleId: string;
    readonly useLinters?: boolean;
  }): Promise<IResult<GetAnalysisResponseDto>> {
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
      const response = await axios.request<GetAnalysisResponseDto>(config);
      return { type: 'success', value: response.data };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.getAnalysis) };
    }
  }

  public async reportError(options: ReportTelemetryRequestDto): Promise<IResult<void>> {
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
      await axios.request(config);
      return { type: 'success', value: undefined };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.reportError) };
    }
  }

  public async reportEvent(options: ReportTelemetryRequestDto): Promise<IResult<void>> {
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
      await axios.request(config);
      return { type: 'success', value: undefined };
    } catch (error) {
      return { type: 'error', error: this.createErrorResponse(error, RequestTypes.reportEvent) };
    }
  }
}
