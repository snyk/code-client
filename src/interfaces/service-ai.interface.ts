import { IConfig } from './config.interface';

import { StartLoginResponseDto } from '../dto/start-login.response.dto';
import { StartLoginRequestDto } from '../dto/start-login.request.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { CheckSessionResponseDto } from '../dto/check-session.response.dto';

export interface IServiceAI {
  /**
   * Initialization of service
   * @param config
   */
  init(config: IConfig): void;

  /**
   * Requests the creation of a new login session
   * @param options
   */
  startLogin(options: StartLoginRequestDto): Promise<StartLoginResponseDto>;

  /**
   * Checks status of the login process
   * @param options
   */
  checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponseDto>;
}
