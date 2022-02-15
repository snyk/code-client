import { v4 as uuidv4 } from 'uuid';
import pick from 'lodash.pick';

import { ErrorCodes, GenericErrorTypes, DEFAULT_ERROR_MESSAGES, MAX_RETRY_ATTEMPTS } from './constants';

import { BundleFiles, SupportedFiles } from './interfaces/files.interface';
import { AnalysisResult } from './interfaces/analysis-result.interface';
import { FailedResponse, makeRequest, Payload } from './needle';
import { AnalysisOptions, AnalysisContext } from './interfaces/analysis-options.interface';

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
  requestId?: string;
}

// The trick to typecast union type alias
function isSubsetErrorCode<T>(code: any, messages: { [c: number]: string }): code is T {
  if (code in messages) {
    return true;
  }
  return false;
}

function generateError<E>(errorCode: number, messages: { [c: number]: string }, apiName: string): ResultError<E> {
  if (!isSubsetErrorCode<E>(errorCode, messages)) {
    throw { errorCode, messages, apiName };
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

export type IpFamily = 6 | undefined;
/**
 * Dispatches a FORCED IPv6 request to test client's ISP and network capability.
 *
 * @return {number} IP family number used by the client.
 */
export async function getIpFamily(authHost: string): Promise<IpFamily> {
  const family = 6;

  // Dispatch a FORCED IPv6 request to test client's ISP and network capability
  const res = await makeRequest(
    {
      url: `${authHost}/verify/callback`,
      method: 'post',
      family, // family param forces the handler to dispatch a request using IP at "family" version
    },
    0,
  );

  const ipv6Incompatible = (<FailedResponse>res).error;

  return ipv6Incompatible ? undefined : family;
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
  readonly ipFamily?: IpFamily;
}

export async function checkSession(options: CheckSessionOptions): Promise<Result<string, CheckSessionErrorCodes>> {
  const defaultValue: ResultSuccess<string> = {
    type: 'success',
    value: '',
  };

  const res = await makeRequest<IApiTokenResponse>({
    url: `${options.authHost}/api/v1/verify/callback`,
    body: {
      token: options.draftToken,
    },
    family: options.ipFamily,
    method: 'post',
  });

  if (res.success) {
    return { ...defaultValue, value: (res.body.ok && res.body.api) || '' };
  } else if ([ErrorCodes.loginInProgress, ErrorCodes.badRequest, ErrorCodes.unauthorizedUser].includes(res.errorCode)) {
    return defaultValue;
  }

  return generateError<CheckSessionErrorCodes>(res.errorCode, CHECK_SESSION_ERROR_MESSAGES, 'checkSession');
}

export async function getFilters(
  baseURL: string,
  source: string,
  attempts = MAX_RETRY_ATTEMPTS,
  requestId?: string,
): Promise<Result<SupportedFiles, GenericErrorTypes>> {
  const apiName = 'filters';

  const res = await makeRequest<SupportedFiles>(
    {
      headers: { source, ...(requestId && { 'snyk-request-id': requestId }) },
      url: `${baseURL}/${apiName}`,
      method: 'get',
    },
    attempts,
  );

  if (res.success) {
    return { type: 'success', value: res.body };
  }
  return generateError<GenericErrorTypes>(res.errorCode, GENERIC_ERROR_MESSAGES, apiName);
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
  options: CreateBundleOptions
): Promise<Result<RemoteBundle, CreateBundleErrorCodes>> {
  const payload: Payload = {
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
      ...(options.requestId && { 'snyk-request-id': options.requestId })
    },
    url: `${options.baseURL}/bundle`,
    method: 'post',
    body: options.files,
  };

  const res = await makeRequest<RemoteBundle>(payload);
  if (res.success) {
    return { type: 'success', value: res.body };
  }
  return generateError<CreateBundleErrorCodes>(res.errorCode, CREATE_BUNDLE_ERROR_MESSAGES, 'createBundle');
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
  const res = await makeRequest<RemoteBundle>({
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
      ...(options.requestId && { 'snyk-request-id': options.requestId })
    },
    url: `${options.baseURL}/bundle/${options.bundleHash}`,
    method: 'get',
  });

  if (res.success) return { type: 'success', value: res.body };
  return generateError<CheckBundleErrorCodes>(res.errorCode, CHECK_BUNDLE_ERROR_MESSAGES, 'checkBundle');
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
  const res = await makeRequest<RemoteBundle>({
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
      ...(options.requestId && { 'snyk-request-id': options.requestId })
    },
    url: `${options.baseURL}/bundle/${options.bundleHash}`,
    method: 'put',
    body: pick(options, ['files', 'removedFiles']),
  });

  if (res.success) return { type: 'success', value: res.body };
  return generateError<ExtendBundleErrorCodes>(res.errorCode, EXTEND_BUNDLE_ERROR_MESSAGES, 'extendBundle');
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

export interface GetAnalysisOptions extends ConnectionOptions, AnalysisOptions, AnalysisContext {
  bundleHash: string;
}

export async function getAnalysis(
  options: GetAnalysisOptions
): Promise<Result<GetAnalysisResponseDto, GetAnalysisErrorCodes>> {
  const config: Payload = {
    headers: {
      ...prepareTokenHeaders(options.sessionToken),
      source: options.source,
      ...(options.requestId && { 'snyk-request-id': options.requestId })
    },
    url: `${options.baseURL}/analysis`,
    method: 'post',
    body: {
      key: {
        type: 'file',
        hash: options.bundleHash,
        limitToFiles: options.limitToFiles || [],
        ...(options.shard ? { shard: options.shard } : null),
      },
      ...pick(options, ['severity', 'prioritized', 'legacy', 'analysisContext']),
    },
  };

  const res = await makeRequest<GetAnalysisResponseDto>(config);
  if (res.success) return { type: 'success', value: res.body };
  return generateError<GetAnalysisErrorCodes>(res.errorCode, GET_ANALYSIS_ERROR_MESSAGES, 'getAnalysis');
}
