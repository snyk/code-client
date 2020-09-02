import axios from 'axios';

const axios_ = axios.create({
  responseType: 'json',
  headers: {
    'Content-Type': 'application/json',
  },
});

axios_.interceptors.request.use(
  config => {
    const { method, url, data } = config;
    console.log(`=> HTTP ${method?.toUpperCase()} ${url} ${data ? JSON.stringify(data) : ''}`.slice(0, 399));

    return config;
  },
  error => {
    throw error;
  },
);

axios_.interceptors.response.use(
  response => {
    console.log(`<= Response: ${response.status} ${JSON.stringify(response.data)}`.slice(0, 399));
    return response;
  },
  error => {
    console.error(`Response error --> ${error.message}`);
    throw error;
  },
);

export default axios_;
