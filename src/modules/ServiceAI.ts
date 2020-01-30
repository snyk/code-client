import { IServiceAI } from '../interfaces/service-ai.interface';
import { IConfig } from '../interfaces/config.interface';

export class ServiceAI implements IServiceAI {

  constructor(
    private baseURL: string,
  ) {
  }

  init(config: IConfig): void {
    this.baseURL = config.baseURL;
  }
}
