import { ServiceAI } from '../src/index';
import { baseConfig } from './mocks/base-config';

describe('Creating instance', () => {
  it('creates and initializes service', () => {
    const AI = new ServiceAI();
    AI.init(baseConfig);

    expect(AI).toBeInstanceOf(ServiceAI);
  });
});
