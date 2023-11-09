import { ORG_ID_REGEXP } from '../constants';
import { JsonApiError } from '../interfaces/json-api';
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

export function isJsonApiErrors(input: unknown): input is JsonApiError[] {
  if (!Array.isArray(input)) {
    return false;
  }

  for (const element of input) {
    if (
      typeof element !== 'object' ||
      !('status' in element) ||
      !('code' in element) ||
      !('title' in element) ||
      !('detail' in element)
    ) {
      return false;
    }
  }

  return true;
}

export function generateErrorWithDetail<E>(error: JsonApiError, statusCode: number, apiName: string): ResultError<E> {
  const errorLink = error.links?.about;
  const detail = `${error.title}: ${error.detail}${errorLink ? ` (more info: ${errorLink})` : ``}`;
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
