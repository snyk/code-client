export type JsonApiError = {
  links?: {
    about?: string;
  };
  status: string;
  code: string;
  title: string;
  detail: string;
};
