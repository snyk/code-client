import { ILoggerConfig } from '../interfaces/logger.interface';

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

  public init(options: ILoggerConfig): void {
    this.useDebug = options.useDebug;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public log(...args: any[]): void {
    if (!this.useDebug) {
      return;
    }

    const time = this.getTime();
    console.log(`[DC-API] ${time} `, ...args);
  }
}
