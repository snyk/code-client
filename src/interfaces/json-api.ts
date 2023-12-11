enum Classification {
  UNEXPECTED = 'UNEXPECTED',
  ACTIONABLE = 'ACTIONABLE',
  UNSUPPORTED = 'UNSUPPORTED',
}

type JsonApiErrorSource = { pointer: string } | { parameter: string } | { header: string };

export type JsonApiErrorObject = {
  id?: string;
  links?: {
    about?: string;
  };
  status: string;
  code: string;
  title: string;
  detail: string;
  source?: JsonApiErrorSource;
  meta: {
    [x: string]: any;

    // Allow consumers to probe if this specific type of JsonApi
    // response originates from an error catalog error.
    isErrorCatalogError: boolean;

    classification?: Classification;

    // Logs related to the error that was thrown
    logs?: string[];
  };
};
