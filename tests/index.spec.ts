import { ServiceAI } from '../src/index';

describe('Creating instance', () => {
  it('creates and initializes service', () => {
    const AI = new ServiceAI();

    expect(AI).toBeInstanceOf(ServiceAI);
  });
});
