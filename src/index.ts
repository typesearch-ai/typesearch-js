import { Typesearch } from './client.ts';

export { Typesearch, Jobs, DEFAULT_BASE_URL } from './client.ts';
export type { ClientOptions, RequestOptions, WaitOptions } from './client.ts';
export { SearchStream } from './stream.ts';
export {
  TypesearchError,
  APIError,
  BadRequestError,
  AuthenticationError,
  BudgetError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
  APIConnectionError,
  APITimeoutError,
  JobFailedError,
} from './errors.ts';
export type * from './types.ts';
export { VERSION } from './version.ts';

export default Typesearch;
