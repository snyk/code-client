import { authHost } from './constants/base';
import { startSession, checkSession, getIpFamily } from '../src/http';

describe('Requests to public API', () => {
  it('starts session successfully', async () => {
    const ipFamily = await getIpFamily(authHost);

    const startSessionResponse = startSession({
      source: 'atom',
      authHost,
    });
    expect(startSessionResponse.loginURL).toMatch(/.*\/login\?token=.*&utm_source=atom/);
    const draftToken = startSessionResponse.draftToken;

    // This token is just a draft and not ready to be used permanently
    const checkSessionResponse = await checkSession({ authHost, draftToken, ipFamily });
    expect(checkSessionResponse.type).toEqual('success');
    if (checkSessionResponse.type == 'error') return;
    expect(checkSessionResponse.value).toEqual('');
  });

  it('checks session unsuccessfully', async () => {
    const response = await checkSession({
      authHost,
      draftToken: 'dummy-token',
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual('');
  });

  // TODO: find a way to test successfull workflow automatically
  // it('checks session successfully', async () => {
  //   const response = await checkSession({
  //     authHost,
  //     sessionToken,
  //   });
  //   expect(response.type).toEqual('success');
  //   if (response.type === 'error') return;
  //   expect(response.value).toEqual(true);
  // });
});
