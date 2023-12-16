/* eslint-disable camelcase */
import http, { OutgoingHttpHeaders } from 'http';
import needle from 'needle';
import * as querystring from 'querystring';
import https from 'https';
import { URL } from 'url';
import { JsonApiErrorObject } from './interfaces/json-api';

import { emitter } from './emitter';
import { ErrorCodes, NETWORK_ERRORS, MAX_RETRY_ATTEMPTS, REQUEST_RETRY_DELAY } from './constants';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

// Snyk CLI allow passing --insecure flag which allows self-signed certificates
// It updates global namespace property ignoreUnknownCA and we can use it in order
// to pass rejectUnauthorized option to https agent
export declare interface Global extends NodeJS.Global {
  ignoreUnknownCA: boolean;
}
declare const global: Global;

const TIMEOUT_DEFAULT = 600000;

const agentOptions = {
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 256, // Maximum number of sockets to allow per host. Defaults to Infinity.
  maxFreeSockets: 256,
  freeSocketTimeout: 60000, // Maximum number of sockets to leave open for 60 seconds in a free state. Only relevant if keepAlive is set to true. Defaults to 256.
  socketActiveTTL: 1000 * 60 * 10,
  rejectUnauthorized: !global.ignoreUnknownCA,
};

export interface Payload {
  body?: needle.BodyData;
  url: string;
  headers?: OutgoingHttpHeaders;
  method: needle.NeedleHttpVerbs;
  qs?: querystring.ParsedUrlQueryInput;
  timeout?: number;
  family?: number;
  isJson?: boolean;
}

interface SuccessResponse<T> {
  success: true;
  body: T;
}

export type FailedResponse = {
  success: false;
  errorCode: number;
  error: Error | undefined;
  errors?: JsonApiErrorObject[] | undefined;
};

export async function makeRequest<T = void>(
  payload: Payload,
  attempts = MAX_RETRY_ATTEMPTS,
): Promise<SuccessResponse<T> | FailedResponse> {
  let data;
  if (!payload.isJson && payload.body) {
    data = payload.body;
  } else {
    data = JSON.stringify(payload.body);
  }

  const parsedUrl = new URL(payload.url);
  const agent = parsedUrl.protocol === 'http:' ? new http.Agent(agentOptions) : new https.Agent(agentOptions);

  const method = (payload.method || 'get').toLowerCase() as needle.NeedleHttpVerbs;
  let { url } = payload;

  if (payload.qs) {
    // Parse the URL and append the search part - this will take care of adding the '/?' part if it's missing
    const urlObject = new URL(url);
    urlObject.search = querystring.stringify(payload.qs);
    url = urlObject.toString();
    delete payload.qs;
  }

  const options: needle.NeedleOptions = {
    use_proxy_from_env_var: false,
    headers: payload.headers,
    open_timeout: TIMEOUT_DEFAULT, // No timeout
    response_timeout: payload.timeout || TIMEOUT_DEFAULT,
    read_timeout: payload.timeout || TIMEOUT_DEFAULT,
    family: payload.family,
    json: payload.isJson || true,
    compressed: true, // sets 'Accept-Encoding' to 'gzip, deflate, br'
    follow_max: 5, // follow up to five redirects
    rejectUnauthorized: !global.ignoreUnknownCA, // verify SSL certificate
    agent,
  };

  emitter.apiRequestLog(`=> HTTP ${method?.toUpperCase()} ${url} ${data ?? ''}`.slice(0, 399));

  do {
    let errorCode: number | undefined;
    let error: Error | undefined;
    let response: needle.NeedleResponse | undefined;

    try {
      response = await needle(method, url, data, options);
      emitter.apiRequestLog(`<= Response: ${response.statusCode} ${JSON.stringify(response.body)}`);
      const success = !!(response.statusCode && response.statusCode >= 200 && response.statusCode < 300);
      if (success) return { success, body: response.body as T };
      errorCode = response.statusCode;
    } catch (err) {
      error = err; // do not swallow the error, pass further to the caller instead
      errorCode = NETWORK_ERRORS[err.code || err.errno];
      emitter.apiRequestLog(`Requested url --> ${url} | error --> ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errorMessage = response?.body?.error;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const errors = response?.body?.errors as JsonApiErrorObject[] | undefined;

    if (errorMessage) {
      error = error ?? new Error(errorMessage);
    }
    errorCode = errorCode ?? ErrorCodes.serviceUnavailable;

    // Try to avoid breaking requests due to temporary network errors
    if (
      attempts > 1 &&
      [
        ErrorCodes.serviceUnavailable,
        ErrorCodes.badGateway,
        ErrorCodes.connectionRefused,
        ErrorCodes.timeout,
        ErrorCodes.dnsNotFound,
        ErrorCodes.serverError,
      ].includes(errorCode)
    ) {
      attempts--;
      await sleep(REQUEST_RETRY_DELAY);
    } else {
      attempts = 0;
      return { success: false, errorCode, error, errors };
    }
  } while (attempts > 0);

  return { success: false, errorCode: ErrorCodes.serviceUnavailable, error: undefined };
}
