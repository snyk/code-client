
import { ServiceAI } from '../src/index';
import { defaultBaseURL as baseURL } from '../src/constants/common';
import { sessionToken } from './mocks/base-config';

// import startMockServer from './mocks/mock-server';
import {
  mockProjectPath,
  mockFiles,
  mockNewAnalysisResults,
} from './mocks/requests';

import { IQueueAnalysisCheckResult } from '../src/interfaces/queue.interface';

// startMockServer();

async function sleep(timeout: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => resolve(), timeout);
  });
}

describe('Requests to public API', () => {
  const AI = new ServiceAI();

  /**
   * Get Analysis Result
   */
  it('gets analysis result', async () => {
    const options = {
      baseURL,
      sessionToken,
      baseDir: mockProjectPath,
      files: mockFiles,
      removedFiles: [],
    };

    AI.on(
      'analyseFinish',
      async (result: IQueueAnalysisCheckResult): Promise<void> => {
        expect(result).toEqual(mockNewAnalysisResults);
      },
    );

    await AI.analyse(options);
    await sleep(500);
  });
});
