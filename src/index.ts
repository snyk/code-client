import * as analysis from './analysis';
import emitter from './emitter';
import { startSession, checkSession } from './http';
import * as constants from './constants';

import { IFileBundle } from './interfaces/analysis-result.interface';

export default {
  analysis,
  startSession,
  checkSession,
  emitter,
  constants,
  IFileBundle,
};
