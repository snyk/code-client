import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import { apiPath, ERRORS, RequestTypes } from './constants';
import axios from './axios';

import { IFiles, IFileContent, ISupportedFiles } from './interfaces/files.interface';
import { IAnalysisResult } from './interfaces/analysis-result.interface';

export type ErrorResponseDto = {
  readonly statusCode: number | null;
  readonly statusText: string;
};

type ResultSuccess<T> = { type: 'success'; value: T };
type ResultError = { type: 'error'; error: ErrorResponseDto };

export type IResult<T> = ResultSuccess<T> | ResultError;

export function createErrorResponse(error: AxiosError, type: RequestTypes): ErrorResponseDto {
  let statusCode: number | null = null;
  if (error && error.response) {
    statusCode = error.response.status || null;
  }

  const errorMessages = ERRORS[type];
  const statusText: string = (statusCode && errorMessages[statusCode]) || errorMessages.other;

  return { statusCode, statusText };
}

type StartSessionResponseDto = {
  readonly sessionToken: string;
  readonly loginURL: string;
};

export async function startSession(options: {
  readonly baseURL: string;
  readonly source: string;
}): Promise<IResult<StartSessionResponseDto>> {
  const { source, baseURL } = options;
  const config: AxiosRequestConfig = {
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
    return { type: 'error', error: createErrorResponse(error, RequestTypes.startSession) };
  }
}

export async function checkSession(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
}): Promise<IResult<boolean>> {
  const { sessionToken, baseURL } = options;
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    url: `${baseURL}${apiPath}/session?cache=${Math.random() * 1000000}`,
    method: 'GET',
  };

  return axios
    .request(config)
    .catch((err: AxiosError) => {
      if (err.response && [304, 400, 401].includes(err.response.status)) {
        return { type: 'success', value: false };
      }
      return { type: 'error', error: createErrorResponse(err, RequestTypes.checkSession) };
    })
    .then((response: AxiosResponse) => {
      return { type: 'success', value: response.status === 200 };
    });
}

export async function getFilters(baseURL: string): Promise<IResult<ISupportedFiles>> {
  const config: AxiosRequestConfig = {
    url: `${baseURL}${apiPath}/filters`,
    method: 'GET',
  };

  try {
    const response = await axios.request<ISupportedFiles>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return { type: 'error', error: createErrorResponse(error, RequestTypes.getFilters) };
  }
}

export type RemoteBundle = {
  readonly bundleId: string;
  readonly missingFiles: string[];
  readonly uploadURL?: string;
};

export async function createBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly files: IFiles;
}): Promise<IResult<RemoteBundle>> {
  const { baseURL, sessionToken, files } = options;
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    url: `${baseURL}${apiPath}/bundle`,
    method: 'POST',
    data: {
      files,
    },
  };

  try {
    const response = await axios.request<RemoteBundle>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return { type: 'error', error: createErrorResponse(error, RequestTypes.createBundle) };
  }
}

export async function checkBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
}): Promise<IResult<RemoteBundle>> {
  const { baseURL, sessionToken, bundleId } = options;
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    url: `${baseURL}${apiPath}/bundle/${bundleId}`,
    method: 'GET',
  };

  try {
    const response = await axios.request<RemoteBundle>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return { type: 'error', error: createErrorResponse(error, RequestTypes.checkBundle) };
  }
}

export async function extendBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly files: IFiles;
  readonly removedFiles?: string[];
}): Promise<IResult<RemoteBundle>> {
  const { baseURL, sessionToken, bundleId, files, removedFiles = [] } = options;
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    url: `${baseURL}${apiPath}/bundle/${bundleId}`,
    method: 'PUT',
    data: {
      files,
      removedFiles,
    },
  };

  try {
    const response = await axios.request<RemoteBundle>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return { type: 'error', error: createErrorResponse(error, RequestTypes.extendBundle) };
  }
}

export async function uploadFiles(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly content: IFileContent[];
}): Promise<IResult<boolean>> {
  const { baseURL, sessionToken, bundleId, content } = options;
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    url: `${baseURL}${apiPath}/file/${bundleId}`,
    method: 'POST',
    data: content,
  };

  try {
    await axios.request(config);
    return { type: 'success', value: true };
  } catch (error) {
    return { type: 'error', error: createErrorResponse(error, RequestTypes.uploadFiles) };
  }
}

// eslint-disable-next-line no-shadow
export enum AnalysisStatus {
  fetching = 'FETCHING',
  analyzing = 'ANALYZING',
  dcDone = 'DC_DONE',
  done = 'DONE',
  failed = 'FAILED',
}

export type AnalysisResponseProgress = {
  readonly status: AnalysisStatus.fetching | AnalysisStatus.analyzing | AnalysisStatus.dcDone;
  readonly progress: number;
};

export type AnalysisFailedResponse = {
  readonly status: AnalysisStatus.failed;
};

export type AnalysisFinishedResponse = {
  readonly status: AnalysisStatus.done;
  readonly analysisURL: string;
  readonly analysisResults: IAnalysisResult;
};

export type GetAnalysisResponseDto = AnalysisFinishedResponse | AnalysisFailedResponse | AnalysisResponseProgress;

export async function getAnalysis(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly useLinters?: boolean;
  readonly severity: number;
}): Promise<IResult<GetAnalysisResponseDto>> {
  const { baseURL, sessionToken, bundleId, useLinters, severity } = options;
  const params = { severity, linters: useLinters };
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    ...params,
    url: `${baseURL}${apiPath}/analysis/${bundleId}`,
    method: 'GET',
  };
  try {
    const response = await axios.request<GetAnalysisResponseDto>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return { type: 'error', error: createErrorResponse(error, RequestTypes.getAnalysis) };
  }
}

type ReportTelemetryRequestDto = {
  readonly baseURL: string;
  readonly sessionToken?: string;
  readonly source?: string;
  readonly type?: string;
  readonly message?: string;
  readonly path?: string;
  readonly bundleId?: string;
  readonly version?: string;
  readonly environmentVersion?: string;
  readonly data?: any;
};

export async function reportError(options: ReportTelemetryRequestDto): Promise<IResult<void>> {
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
    return { type: 'error', error: createErrorResponse(error, RequestTypes.reportError) };
  }
}

export async function reportEvent(options: ReportTelemetryRequestDto): Promise<IResult<void>> {
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
    return { type: 'error', error: createErrorResponse(error, RequestTypes.reportEvent) };
  }
}
