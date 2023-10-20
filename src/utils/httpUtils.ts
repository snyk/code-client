import { ORG_ID_REGEXP } from '../constants';

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
