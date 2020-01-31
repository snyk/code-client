import { BASE_URL } from '../src/config';
import { ServiceAI } from '../src/index';
import { IConfig } from '../src/interfaces/config.interface';

const instance = new ServiceAI();
const baseConfig: IConfig = {
  baseURL: BASE_URL,
  useDebug: false,
};

test('Valid initialization', () => {
  instance.init(baseConfig);
  const stats = instance.getStats();

  expect(stats.baseURL).toEqual(baseConfig.baseURL);
});
