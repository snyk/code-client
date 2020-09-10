
describe('files', () => {

  // test_filters
  // test_meta_utf8_file
  // test_meta_iso8859_file
  // test_bundle_hashes
  

  it('makes successful request', async () => {
    const config: AxiosRequestConfig = {
      url: `${baseURL}${apiPath}/agent-response`,
      method: 'GET',
    };
    const mockData = {
      name: 'agent',
    };

    const { data } = await axios.request(config);

    expect(data).toEqual(mockData);
  });
});
