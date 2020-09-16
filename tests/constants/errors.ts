
import { ERRORS, RequestTypes } from '../../src/constants';

/**
 * Errors
 */
export const checkBundleError404 = {
  statusCode: 404,
  statusText: ERRORS[RequestTypes.checkBundle][404],
};

export const extendBundleError404 = {
  statusCode: 404,
  statusText: ERRORS[RequestTypes.extendBundle][404],
};

