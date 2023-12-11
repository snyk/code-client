import { ORG_ID_REGEXP } from '../constants';
import { JsonApiErrorObject } from '../interfaces/json-api';
import { ResultError } from '../http';

export function getURL(baseURL: string, path: string, orgId?: string): string {
  if (routeToGateway(baseURL)) {
    if (!isValidOrg(orgId)) {
      throw new Error('A valid Org id is required for this operation');
    }
    return `${baseURL}/hidden/orgs/${orgId}/code${path}`;
  }
  return `${baseURL}${path}`;
}

function routeToGateway(baseURL: string): boolean {
  return baseURL.includes('snykgov.io');
}

function isValidOrg(orgId?: string): boolean {
  return orgId !== undefined && ORG_ID_REGEXP.test(orgId);
}

export function generateErrorWithDetail<E>(
  error: JsonApiErrorObject,
  statusCode: number,
  apiName: string,
): ResultError<E> {
  const errorLink = error.links?.about;
  const detail = `${error.title}${error.detail ? `: ${error.detail}` : ''}${
    errorLink ? ` (more info: ${errorLink})` : ``
  }`;
  const statusText = error.title;
  return {
    type: 'error',
    error: {
      apiName,
      statusCode: statusCode as unknown as E,
      statusText,
      detail,
    },
  };
}
