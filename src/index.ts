import { analyzeFolders, analyzeGit } from './analysis';
import * as events from './emitter';
import { startSession, checkSession } from './http';

export default {
  analyzeFolders,
  analyzeGit,
  startSession,
  checkSession,
  events,
};
