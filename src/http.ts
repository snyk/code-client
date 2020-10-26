import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import { apiPath, ErrorCodes, GenericErrorTypes, DEFAULT_ERROR_MESSAGES } from './constants';
import axios from './axios';

import { IFiles, IFileContent, ISupportedFiles } from './interfaces/files.interface';
import { IAnalysisResult } from './interfaces/analysis-result.interface';

type ResultSuccess<T> = { type: 'success'; value: T };
type ResultError<E> = {
  type: 'error';
  error: {
    statusCode: E;
    statusText: string;
    apiName: string;
  };
};

export type IResult<T, E> = ResultSuccess<T> | ResultError<E>;

export function determineErrorCode(error: AxiosError | any): ErrorCodes {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { response }: { response: AxiosResponse | undefined } = error;
  if (response) {
    return response.status;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { errno, code }: { errno: string | undefined; code: string | number | undefined } = error;
  if (errno === 'ECONNREFUSED') {
    // set connectionRefused item
    return ErrorCodes.connectionRefused;
  }
  if (code === 'ENOTFOUND') {
    return ErrorCodes.dnsNotFound;
  }

  // We must be strict here and if none of our existing logic recognized this error, just throw it up.
  throw error;
}

// The trick to typecast union type alias
function isSubsetErrorCode<T>(code: any, messages: { [c: number]: string }): code is T {
  if (code in messages) {
    return true;
  }
  return false;
}

function generateError<E>(error: AxiosError | any, messages: { [c: number]: string }, apiName: string): ResultError<E> {
  const errorCode = determineErrorCode(error);

  if (!isSubsetErrorCode<E>(errorCode, messages)) {
    throw error;
  }

  const statusCode = errorCode;
  const statusText = messages[errorCode];

  return {
    type: 'error',
    error: {
      apiName,
      statusCode,
      statusText,
    },
  };
}

type StartSessionResponseDto = {
  readonly sessionToken: string;
  readonly loginURL: string;
};

const GENERIC_ERROR_MESSAGES: { [P in GenericErrorTypes]: string } = {
  [ErrorCodes.serverError]: DEFAULT_ERROR_MESSAGES[ErrorCodes.serverError],
  [ErrorCodes.badGateway]: DEFAULT_ERROR_MESSAGES[ErrorCodes.badGateway],
  [ErrorCodes.serviceUnavailable]: DEFAULT_ERROR_MESSAGES[ErrorCodes.serviceUnavailable],
  [ErrorCodes.timeout]: DEFAULT_ERROR_MESSAGES[ErrorCodes.timeout],
  [ErrorCodes.dnsNotFound]: DEFAULT_ERROR_MESSAGES[ErrorCodes.dnsNotFound],
  [ErrorCodes.connectionRefused]: DEFAULT_ERROR_MESSAGES[ErrorCodes.connectionRefused],
};

export async function startSession(options: {
  readonly baseURL: string;
  readonly source: string;
}): Promise<IResult<StartSessionResponseDto, GenericErrorTypes>> {
  const apiName = 'login';
  const { source, baseURL } = options;
  const config: AxiosRequestConfig = {
    url: `${baseURL}${apiPath}/${apiName}`,
    method: 'POST',
    data: {
      source,
    },
  };

  try {
    const response = await axios.request<StartSessionResponseDto>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GenericErrorTypes>(error, GENERIC_ERROR_MESSAGES, apiName);
  }
}

type CheckSessionErrorCodes = GenericErrorTypes | ErrorCodes.unauthorizedUser | ErrorCodes.loginInProgress;
const CHECK_SESSION_ERROR_MESSAGES: { [P in CheckSessionErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.loginInProgress]: DEFAULT_ERROR_MESSAGES[ErrorCodes.loginInProgress],
};

export async function checkSession(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
}): Promise<IResult<boolean, CheckSessionErrorCodes>> {
  const { sessionToken, baseURL } = options;
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    url: `${baseURL}${apiPath}/session?cache=${Math.random() * 1000000}`,
    method: 'GET',
  };

  // deepcode ignore PromiseNotCaughtGeneral: typescript makes it all a bit complex here
  return axios
    .request(config)
    .catch((err: AxiosError) => {
      if (err.response && [304, 400, 401].includes(err.response.status)) {
        return { type: 'success', value: false };
      }

      return generateError<CheckSessionErrorCodes>(err, CHECK_SESSION_ERROR_MESSAGES, 'checkSession');
    })
    .then((response: AxiosResponse) => {
      return { type: 'success', value: response.status === 200 };
    });
}

export async function getFilters(baseURL: string): Promise<IResult<ISupportedFiles, GenericErrorTypes>> {
  const apiName = 'filters';
  const config: AxiosRequestConfig = {
    url: `${baseURL}${apiPath}/${apiName}`,
    method: 'GET',
  };

  try {
    const response = await axios.request<ISupportedFiles>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GenericErrorTypes>(error, GENERIC_ERROR_MESSAGES, apiName);
  }
}

export type RemoteBundle = {
  readonly bundleId: string;
  readonly missingFiles: string[];
  readonly uploadURL?: string;
};

export type CreateBundleErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.bigPayload
  | ErrorCodes.unauthorizedContent
  | ErrorCodes.notFound;

const CREATE_BUNDLE_ERROR_MESSAGES: { [P in CreateBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.bigPayload]: DEFAULT_ERROR_MESSAGES[ErrorCodes.bigPayload],
  [ErrorCodes.unauthorizedContent]: `Request content doesn't match the specifications`,
  [ErrorCodes.notFound]: 'Unable to resolve requested oid',
};

export async function createBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly files: IFiles;
}): Promise<IResult<RemoteBundle, CreateBundleErrorCodes>> {
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
    return generateError<CreateBundleErrorCodes>(error, CREATE_BUNDLE_ERROR_MESSAGES, 'createBundle');
  }
}

export type CheckBundleErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.notFound;

const CHECK_BUNDLE_ERROR_MESSAGES: { [P in CheckBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.notFound]: 'Uploaded bundle has expired',
};

export async function checkBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
}): Promise<IResult<RemoteBundle, CheckBundleErrorCodes>> {
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
    return generateError<CheckBundleErrorCodes>(error, CHECK_BUNDLE_ERROR_MESSAGES, 'checkBundle');
  }
}

export type ExtendBundleErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedContent
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.bigPayload
  | ErrorCodes.notFound;

const EXTEND_BUNDLE_ERROR_MESSAGES: { [P in ExtendBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.bigPayload]: DEFAULT_ERROR_MESSAGES[ErrorCodes.bigPayload],
  [ErrorCodes.unauthorizedContent]: `Attempted to extend a git bundle, or ended up with an empty bundle after the extension`,
  [ErrorCodes.unauthorizedBundleAccess]: 'Unauthorized access to parent bundle',
  [ErrorCodes.notFound]: 'Parent bundle has expired',
};

export async function extendBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly files: IFiles;
  readonly removedFiles?: string[];
}): Promise<IResult<RemoteBundle, ExtendBundleErrorCodes>> {
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
    return generateError<ExtendBundleErrorCodes>(error, EXTEND_BUNDLE_ERROR_MESSAGES, 'extendBundle');
  }
}

type CreateGitBundleErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.notFound;

const CREATE_GIT_BUNDLE_ERROR_MESSAGES: { [P in CreateGitBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.notFound]: 'Unable to found requested repository or commit hash',
};

export async function createGitBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly oAuthToken?: string;
  readonly gitUri: string;
}): Promise<IResult<RemoteBundle, CreateGitBundleErrorCodes>> {
  const { baseURL, sessionToken, oAuthToken, gitUri } = options;
  const params = { oAuthToken };
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    params,
    url: `${baseURL}${apiPath}/bundle`,
    method: 'POST',
    data: { gitURI: gitUri },
  };

  try {
    const response = await axios.request<RemoteBundle>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<CreateGitBundleErrorCodes>(error, CREATE_GIT_BUNDLE_ERROR_MESSAGES, 'createBundle');
  }
}

type UploadBundleErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedContent
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.notFound
  | ErrorCodes.bigPayload;

const UPLOAD_BUNDLE_ERROR_MESSAGES: { [P in UploadBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.notFound]: DEFAULT_ERROR_MESSAGES[ErrorCodes.notFound],
  [ErrorCodes.bigPayload]: DEFAULT_ERROR_MESSAGES[ErrorCodes.bigPayload],
  [ErrorCodes.unauthorizedContent]: `Invalid request, attempted to extend a git bundle, or ended up with an empty bundle after the extension`,
};

export async function uploadFiles(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleId: string;
  readonly content: IFileContent[];
}): Promise<IResult<boolean, UploadBundleErrorCodes>> {
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
    return generateError<UploadBundleErrorCodes>(error, UPLOAD_BUNDLE_ERROR_MESSAGES, 'uploadFiles');
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

export type GetAnalysisErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.notFound;

const GET_ANALYSIS_ERROR_MESSAGES: { [P in GetAnalysisErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.notFound]: DEFAULT_ERROR_MESSAGES[ErrorCodes.notFound],
  [ErrorCodes.serverError]: 'Getting analysis failed',
};

export async function getAnalysis(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly oAuthToken?: string;
  readonly bundleId: string;
  readonly useLinters?: boolean;
  readonly severity: number;
}): Promise<IResult<GetAnalysisResponseDto, GetAnalysisErrorCodes>> {
  const { baseURL, sessionToken, oAuthToken, bundleId, useLinters, severity } = options;
  // ?linters=false is still a truthy query value, if(useLinters === false) we have to avoid sending the value altogether
  const params = { severity, linters: useLinters || undefined, oAuthToken };
  const config: AxiosRequestConfig = {
    headers: { 'Session-Token': sessionToken },
    params,
    url: `${baseURL}${apiPath}/analysis/${bundleId}`,
    method: 'GET',
  };
  try {
    const response = await axios.request<GetAnalysisResponseDto>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GetAnalysisErrorCodes>(error, GET_ANALYSIS_ERROR_MESSAGES, 'getAnalysis');
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

export async function reportError(options: ReportTelemetryRequestDto): Promise<IResult<void, GenericErrorTypes>> {
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
    return generateError<GenericErrorTypes>(error, GENERIC_ERROR_MESSAGES, 'reportError');
  }
}

export async function reportEvent(options: ReportTelemetryRequestDto): Promise<IResult<void, GenericErrorTypes>> {
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
    return generateError<GenericErrorTypes>(error, GENERIC_ERROR_MESSAGES, 'reportEvent');
  }
}
