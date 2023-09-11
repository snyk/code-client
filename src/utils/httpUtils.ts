export function getURL(baseURL: string, path: string, orgId?: string): string {
  if (routeToGateway(baseURL)) {
    if (!orgId) {
      throw new Error('Org is required for this operation');
    }
    return `${baseURL}/hidden/orgs/${orgId}/code${path}`;
  }
  return `${baseURL}${path}`;
}

function routeToGateway(baseURL: string): boolean {
  return baseURL.includes('snykgov.io');
}
