import { BASE_URL } from '../src/config';
import { ServiceAI } from '../src/index';
import { IConfig } from '../src/interfaces/config.interface';

const baseConfig: IConfig = {
  baseURL: BASE_URL,
  useDebug: false,
};

describe('Creating instance', () => {
  it('creates and initializes service', () => {
    const AI = new ServiceAI();
    AI.init(baseConfig);

    expect(AI).toBeInstanceOf(ServiceAI);
  });
});
