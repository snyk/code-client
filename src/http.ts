/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import pick from 'lodash.pick';

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

export interface ConnectionOptions {
  baseURL: string;
  sessionToken: string;
  source: string;
}

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

interface StartSessionOptions {
  readonly authHost: string;
  readonly source: string;
}

export function startSession(options: StartSessionOptions): StartSessionResponseDto {
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

interface CheckSessionOptions {
  readonly authHost: string;
  readonly draftToken: string;
}

export async function checkSession(options: CheckSessionOptions): Promise<Result<string, CheckSessionErrorCodes>> {
  const config: AxiosRequestConfig = {
    baseURL: options.authHost,
    url: `/api/v1/verify/callback`,
    method: 'POST',
    data: {
      token: options.draftToken,
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
  const config: AxiosRequestConfig = {
    headers: { source },
    baseURL,
    url: `/filters`,
    method: 'GET',
  };

  try {
    const response = await axios.request<SupportedFiles>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GenericErrorTypes>(error, GENERIC_ERROR_MESSAGES, 'filters');
  }
}

function prepareTokenHeaders(sessionToken: string) {
  return {
    'Session-Token': sessionToken,
    // We need to be able to test code-client without deepcode locally
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

interface CreateBundleOptions extends ConnectionOptions {
  files: BundleFiles;
}

export async function createBundle(
  options: CreateBundleOptions,
): Promise<Result<RemoteBundle, CreateBundleErrorCodes>> {
  const config: AxiosRequestConfig = {
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
    },
    baseURL: options.baseURL,
    url: `/bundle`,
    method: 'POST',
    data: options.files,
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

interface CheckBundleOptions extends ConnectionOptions {
  bundleHash: string;
}

export async function checkBundle(options: CheckBundleOptions): Promise<Result<RemoteBundle, CheckBundleErrorCodes>> {
  const config: AxiosRequestConfig = {
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
    },
    baseURL: options.baseURL,
    url: `/bundle/${options.bundleHash}`,
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

interface ExtendBundleOptions extends ConnectionOptions {
  readonly bundleHash: string;
  readonly files: BundleFiles;
  readonly removedFiles?: string[];
}

export async function extendBundle(
  options: ExtendBundleOptions,
): Promise<Result<RemoteBundle, ExtendBundleErrorCodes>> {
  const config: AxiosRequestConfig = {
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
    },
    baseURL: options.baseURL,
    url: `/bundle/${options.bundleHash}`,
    method: 'PUT',
    data: pick(options, ['files', 'removedFiles']),
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

export interface AnalysisOptions {
  readonly severity: number;
  readonly limitToFiles?: string[];
}

export interface GetAnalysisOptions extends ConnectionOptions, AnalysisOptions {
  readonly bundleHash: string;
}

export async function getAnalysis(
  options: GetAnalysisOptions,
): Promise<Result<GetAnalysisResponseDto, GetAnalysisErrorCodes>> {
  const config: AxiosRequestConfig = {
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
    },
    baseURL: options.baseURL,
    url: `/analysis`,
    method: 'POST',
    data: {
      key: {
        type: 'file',
        hash: options.bundleHash,
        limitToFiles: options.limitToFiles || [],
      },
      severity: options.severity,
    },
  };

  try {
    const response = await axios.request<GetAnalysisResponseDto>(config);
    return { type: 'success', value: response.data };
  } catch (error) {
    return generateError<GetAnalysisErrorCodes>(error, GET_ANALYSIS_ERROR_MESSAGES, 'getAnalysis');
  }
}
