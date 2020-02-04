import { Logger } from '../src/modules/Logger';
// import { ILoggerConfig } from '../src/interfaces/logger.interface';

describe('Logger', () => {
  let consoleOutput: string[] = [];
  const originalLog = console.log;
  const mockedLog = (output: string) => consoleOutput.push(output);

  beforeEach(() => {
    consoleOutput = [];
    console.log = mockedLog;
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('logs with useDebug', () => {
    const logger = new Logger(true);
    logger.log('Logger');

    expect(consoleOutput.length).toEqual(1);
  });

  it('does not log without useDebug', () => {
    const logger = new Logger(false);
    logger.log('Logger');

    expect(consoleOutput.length).toEqual(0);
  });

  it('switches option useDebug', () => {
    const logger = new Logger(false);
    logger.log('Logger');

    expect(consoleOutput.length).toEqual(0);

    logger.init({ useDebug: true });
    logger.log('Logger');

    expect(consoleOutput.length).toEqual(1);
  });
});
