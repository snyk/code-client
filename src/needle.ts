import http, { OutgoingHttpHeaders } from 'http';
import needle from 'needle';
import * as querystring from 'querystring';
import https from 'https';
import { URL } from 'url';
import emitter from './emitter';

// Snyk CLI allow passing --insecure flag which allows self-signed certificates
// It updates global namespace property ignoreUnknownCA and we can use it in order
// to pass rejectUnauthorized option to https agent
export declare interface Global extends NodeJS.Global {
  ignoreUnknownCA: boolean;
}
declare const global: Global;

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
}

export function makeRequest(payload: Payload): Promise<{ success: boolean; response: needle.NeedleResponse }> {
  const data = JSON.stringify(payload.body);

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
    headers: payload.headers,
    timeout: payload.timeout,
    family: payload.family,
    json: true,
    compressed: true, // sets 'Accept-Encoding' to 'gzip, deflate, br'
    follow_max: 5, // follow up to five redirects
    rejectUnauthorized: !global.ignoreUnknownCA, // verify SSL certificate
    open_timeout: 0,
    agent,
  };

  emitter.apiRequestLog(`=> HTTP ${method?.toUpperCase()} ${url} ${data ?? ''}`.slice(0, 399));

  return needle(method, url, data, options)
    .then(response => {
      emitter.apiRequestLog(`<= Response: ${response.statusCode} ${JSON.stringify(response.body)}`.slice(0, 399));
      const success = !!(response.statusCode && response.statusCode >= 200 && response.statusCode < 300);
      return { success, response };
    })
    .catch(err => {
      emitter.apiRequestLog(`Request error --> ${err}`.slice(0, 399));
      throw err;
    });
}
