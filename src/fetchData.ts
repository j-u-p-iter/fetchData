import { CommonHttpError } from "@j.u.p.iter/custom-error";
import AbortController from "abort-controller";
import deepMerge from "deepmerge";

/**
 * Handle known errors (HTTPError, TypeError)
 *   and throw uknown unexpected errors.
 */

enum HTTPMethod {
  GET = "get",
  PUT = "put",
  POST = "post",
  PATCH = "patch",
  DELETE = "delete"
}

enum ResponseBodyType {
  JSON = "json",
  BLOB = "blob",
  TEXT = "text",
  FORM_DATA = "formData",
  ARRAY_BUFFER = "arrayBuffer"
}

interface FetchDataOptions extends RequestInit {
  /**
   * The "type" is used to set up the method you want
   *   to call on the response intance to extract
   *   the response's body. By default it's set up to the "json",
   *   cause in the mafority of cases the consumer we'll
   *   need to use the data as "json".
   */
  urlPrefix?: string;
  type?: ResponseBodyType;
  data?: { [key: string]: any };
  hooks?: {
    beforeRequest?: Array<(request: Request) => void>;
    afterResponse?: Array<(response: Response) => void>;
  };
}

interface FetchDataResponse<T> {
  cancel: () => void;
  status: number;
  statusText: string;
  data: T;
}

const isObject = input => typeof input === "object" && input !== null;

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[];
}

const DEFAULT_EXPECTED_DATA_TYPE = "json";
const CONTENT_TYPE_HEADER = {
  "Content-Type": "application/json;charset=utf-8"
};
const CONTENT_TYPE_HEADER_TITLE = Object.keys(CONTENT_TYPE_HEADER)[0];

const runBeforeRequestHooks = (
  hooks: Array<(request: Request) => void>,
  request: Request
) => {
  for (const hook of hooks) {
    hook(request);
  }
};

const runAfterResponseHooks = (
  hooks: Array<(response: Response) => void>,
  response: Response
) => {
  for (const hook of hooks) {
    hook(response);
  }
};

const optionsReducer = (options: any, httpMethod: HTTPMethod) => {
  if (
    httpMethod === HTTPMethod.POST ||
    httpMethod === HTTPMethod.PUT ||
    httpMethod === HTTPMethod.PATCH
  ) {
    /**
     * If a request body is a string, the Content-Type header is set to
     *  "text/plain;chartset=utf-8" by default.
     *
     * If options.body is an object we'll need to JSON.stringify it
     *  before sending it to the serveri. So, in this case the "Content-Type"
     *  header will be set up as "text/plain;charset=utf-8" by default.
     *
     * Because we send JSON to the server but not the plain text we need
     *  to reassign value for the default "Content-Type"
     *  header to "application/json;charset=utf-8".
     *
     */

    if (
      isObject(options.body) &&
      !options.headers?.[CONTENT_TYPE_HEADER_TITLE]
    ) {
      options.headers = {
        ...(options.headers || {}),
        ...CONTENT_TYPE_HEADER
      };
    }

    if (options.body) {
      options.body = JSON.stringify(options.body);
    }
  }

  return options;
};

const constructURL = (url: string, urlPrefix: string): string => {
  if (!urlPrefix) {
    return url;
  }

  let resultURL = url;
  let resultURLPrefix = urlPrefix;

  /**
   * We don't allow to start url without "/",
   *   to make it look like a relative path.
   *
   */
  if (url.startsWith("/")) {
    resultURL = url.replace(/^\//, "");
  }

  if (!urlPrefix.endsWith("/")) {
    resultURLPrefix = urlPrefix + "/";
  }

  return resultURLPrefix + resultURL;
};

/**
 * Private _fetch method.
 *
 * Responsible for
 *   1. taking request's url and request's options;
 *   2. preparing request's options with help of "optionsReducer";
 *   3. sending HTTP request;
 *   4. resolving HTTP request.
 *   5. returning back all response-related data.
 *
 */
const internalFetch = <T>(
  url: string,
  originalOptions: FetchDataOptions,
  httpMethod: HTTPMethod
): { request: Promise<FetchDataResponse<T>>; cancelRequest: () => void } => {
  const { type, urlPrefix, hooks = {}, ...options } = originalOptions;

  const resultURL = constructURL(url, urlPrefix);

  /**
   * Assign request to a variable to be able to pass it with CommonHttpError
   */

  const abortController = new AbortController();
  const cancelRequest = () => {
    abortController.abort();
  };

  const request = new Request(
    resultURL,
    optionsReducer(
      {
        ...options,
        signal: abortController.signal
      },
      httpMethod
    )
  );

  if (hooks.beforeRequest) {
    runBeforeRequestHooks(hooks.beforeRequest, request);
  }

  return {
    request: (async () => {
      const response = await fetch(request);

      if (hooks.afterResponse) {
        runAfterResponseHooks(hooks.afterResponse, response);
      }

      /**
       * Instead of resolving Promise in case of error status (as native Fetch API does),
       *   we reject it
       *
       */
      if (!response.ok) {
        throw CommonHttpError(
          "Request is not resolved successfully",
          { code: response.status, response, request },
          { context: "@j.u.p.iter/fetch-data" }
        );
      }

      /**
       * In majority of cases we need to resolve data
       *   as a json. So, we set up the "json" resolving method
       *   as a default one.
       */
      const expectedDataType = type || DEFAULT_EXPECTED_DATA_TYPE;
      const responseData = await response[expectedDataType]();

      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        cancel: cancelRequest
      };
    })(),

    cancelRequest
  };
};

/**
 * Iterates through the enum to declare shortcut methods for all possible
 *   types of HTTP requests in one single place without necessety to
 *   duplicate things.
 *
 */
export const createFetchData = (
  defaultOptions: Partial<FetchDataOptions> = {}
) => {
  /**
   * Loop through all http methods and create "fetch method" for
   *   each of them.
   *
   */
  return enumKeys(HTTPMethod).reduce((resultFetchData, httpMethod) => {
    resultFetchData[HTTPMethod[httpMethod]] = <T = any>(
      url: string,
      options: FetchDataOptions = {}
    ) => {
      const mergedOptions = deepMerge(defaultOptions, options);

      return internalFetch<T>(
        url,
        {
          method: HTTPMethod[httpMethod],
          ...mergedOptions
        },
        HTTPMethod[httpMethod]
      );
    };

    return resultFetchData;
  }, {}) as any;
};

export const fetchData = createFetchData();
