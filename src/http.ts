/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import omit from 'lodash.omit';

import { ErrorCodes, GenericErrorTypes, DEFAULT_ERROR_MESSAGES } from './constants';
import axios from './axios';

import { BundleFiles, SupportedFiles } from './interfaces/files.interface';
import { AnalysisResult } from './interfaces/analysis-result.interface';

type ResultSuccess<T> = { type: 'success'; value: T };
type ResultError<E> = {
  type: 'error';
  error: {
    statusCode: E;
    statusText: string;
    apiName: string;
  };
};

export type Result<T, E> = ResultSuccess<T> | ResultError<E>;

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
  if (errno === 'ECONNRESET') {
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
  readonly draftToken: string;
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

export function startSession(options: { readonly authHost: string; readonly source: string }): StartSessionResponseDto {
  const { source, authHost } = options;
  const draftToken = uuidv4();

  return {
    draftToken,
    loginURL: `${authHost}/login?token=${draftToken}&utm_medium=${source}&utm_source=${source}&utm_campaign=${source}&docker=false`,
  };
}

type CheckSessionErrorCodes = GenericErrorTypes | ErrorCodes.unauthorizedUser | ErrorCodes.loginInProgress;
const CHECK_SESSION_ERROR_MESSAGES: { [P in CheckSessionErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.loginInProgress]: DEFAULT_ERROR_MESSAGES[ErrorCodes.loginInProgress],
};

interface IApiTokenResponse {
  ok: boolean;
  api: string;
}

export async function checkSession(options: {
  readonly authHost: string;
  readonly draftToken: string;
}): Promise<Result<string, CheckSessionErrorCodes>> {
  const { draftToken, authHost } = options;
  const config: AxiosRequestConfig = {
    url: `${authHost}/api/v1/verify/callback`,
    method: 'POST',
    data: {
      token: draftToken,
    },
  };

  try {
    const response = await axios.request<IApiTokenResponse>(config);
    return {
      type: 'success',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      value: (response.status === 200 && response.data.ok && response.data.api) || '',
    };
  } catch (err) {
    if (
      [ErrorCodes.loginInProgress, ErrorCodes.badRequest, ErrorCodes.unauthorizedUser].includes(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        err.response?.status,
      )
    ) {
      return { type: 'success', value: '' };
    }

    return generateError<CheckSessionErrorCodes>(err, CHECK_SESSION_ERROR_MESSAGES, 'checkSession');
  }
}

export async function getFilters(baseURL: string, source: string): Promise<Result<SupportedFiles, GenericErrorTypes>> {
  const apiName = 'filters';
  const config: AxiosRequestConfig = {
    headers: { source },
    url: `${baseURL}/${apiName}`,
    method: 'GET',
  };

  try {
    const response = await axios.request<SupportedFiles>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GenericErrorTypes>(error, GENERIC_ERROR_MESSAGES, apiName);
  }
}

function prepareTokenHeaders(sessionToken: string) {
  return {
    'Session-Token': sessionToken,
    Authorization: `Bearer ${sessionToken}`,
  };
}

export type RemoteBundle = {
  readonly bundleHash: string;
  readonly missingFiles: string[];
};

export type CreateBundleErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.bigPayload
  | ErrorCodes.badRequest
  | ErrorCodes.notFound;

const CREATE_BUNDLE_ERROR_MESSAGES: { [P in CreateBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.bigPayload]: DEFAULT_ERROR_MESSAGES[ErrorCodes.bigPayload],
  [ErrorCodes.badRequest]: `Request payload doesn't match the specifications`,
  [ErrorCodes.notFound]: 'Unable to resolve requested oid',
};

export async function createBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly files: BundleFiles;
  readonly source: string;
}): Promise<Result<RemoteBundle, CreateBundleErrorCodes>> {
  const { baseURL, sessionToken, files, source } = options;

  const config: AxiosRequestConfig = {
    headers: {
      ...prepareTokenHeaders(sessionToken),
      source,
    },
    url: `${baseURL}/bundle`,
    method: 'POST',
    data: files,
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
  readonly bundleHash: string;
}): Promise<Result<RemoteBundle, CheckBundleErrorCodes>> {
  const { baseURL, sessionToken, bundleHash } = options;
  const config: AxiosRequestConfig = {
    headers: prepareTokenHeaders(sessionToken),
    url: `${baseURL}/bundle/${bundleHash}`,
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
  | ErrorCodes.badRequest
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.bigPayload
  | ErrorCodes.notFound;

const EXTEND_BUNDLE_ERROR_MESSAGES: { [P in ExtendBundleErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.bigPayload]: DEFAULT_ERROR_MESSAGES[ErrorCodes.bigPayload],
  [ErrorCodes.badRequest]: `Bad request`,
  [ErrorCodes.unauthorizedBundleAccess]: 'Unauthorized access to parent bundle',
  [ErrorCodes.notFound]: 'Parent bundle has expired',
};

export async function extendBundle(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleHash: string;
  readonly files: BundleFiles;
  readonly removedFiles?: string[];
}): Promise<Result<RemoteBundle, ExtendBundleErrorCodes>> {
  const { baseURL, sessionToken, bundleHash, files, removedFiles = [] } = options;
  const config: AxiosRequestConfig = {
    headers: prepareTokenHeaders(sessionToken),
    url: `${baseURL}/bundle/${bundleHash}`,
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

// eslint-disable-next-line no-shadow
export enum AnalysisStatus {
  waiting = 'WAITING',
  fetching = 'FETCHING',
  analyzing = 'ANALYZING',
  done = 'DONE',
  failed = 'FAILED',
  complete = 'COMPLETE',
}

export type AnalysisResponseProgress = {
  readonly status: AnalysisStatus.waiting | AnalysisStatus.fetching | AnalysisStatus.analyzing | AnalysisStatus.done;
  readonly progress: number;
};

export type AnalysisFailedResponse = {
  readonly status: AnalysisStatus.failed;
};

export type GetAnalysisResponseDto = AnalysisResult | AnalysisFailedResponse | AnalysisResponseProgress;

export type GetAnalysisErrorCodes =
  | GenericErrorTypes
  | ErrorCodes.unauthorizedUser
  | ErrorCodes.unauthorizedBundleAccess
  | ErrorCodes.badRequest
  | ErrorCodes.notFound;

const GET_ANALYSIS_ERROR_MESSAGES: { [P in GetAnalysisErrorCodes]: string } = {
  ...GENERIC_ERROR_MESSAGES,
  [ErrorCodes.unauthorizedUser]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedUser],
  [ErrorCodes.unauthorizedBundleAccess]: DEFAULT_ERROR_MESSAGES[ErrorCodes.unauthorizedBundleAccess],
  [ErrorCodes.notFound]: DEFAULT_ERROR_MESSAGES[ErrorCodes.notFound],
  [ErrorCodes.badRequest]: DEFAULT_ERROR_MESSAGES[ErrorCodes.badRequest],
  [ErrorCodes.serverError]: 'Getting analysis failed',
};

export async function getAnalysis(options: {
  readonly baseURL: string;
  readonly sessionToken: string;
  readonly bundleHash: string;
  readonly severity: number;
  readonly limitToFiles?: string[];
  readonly source: string;
}): Promise<Result<GetAnalysisResponseDto, GetAnalysisErrorCodes>> {
  const { baseURL, sessionToken, bundleHash, severity, limitToFiles, source } = options;

  const headers = {
    ...prepareTokenHeaders(sessionToken),
    source,
  };

  const config: AxiosRequestConfig = {
    headers,
    url: `${baseURL}/analysis`,
    method: 'POST',
    data: {
      key: {
        type: 'file',
        hash: bundleHash,
        limitToFiles: limitToFiles || [],
      },
      severity,
    },
  };

  try {
    const response = await axios.request<GetAnalysisResponseDto>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GetAnalysisErrorCodes>(error, GET_ANALYSIS_ERROR_MESSAGES, 'getAnalysis');
  }
}

