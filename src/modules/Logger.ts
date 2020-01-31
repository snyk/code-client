import { PACKAGE_SHORT_NAME } from '../config';

export interface ILoggerConfig {
  useDebug: boolean;
}

export class Logger {
  constructor(private useDebug: boolean) {}

  private format(num: number | string): string {
    return `0${num}`.slice(-2);
  }

  private getTime(): string {
    const now = new Date();
    const hour = this.format(now.getHours());
    const min = this.format(now.getMinutes());
    const sec = this.format(now.getSeconds());

    return `${hour}:${min}:${sec}`;
  }

  init(options: ILoggerConfig): void {
    this.useDebug = options.useDebug;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...args: any[]): void {
    if (!this.useDebug) {
      return;
    }

    const time = this.getTime();
    console.log(`[${PACKAGE_SHORT_NAME}] ${time} `, ...args);
  }
}
