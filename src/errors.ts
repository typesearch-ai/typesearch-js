import type { FieldError, Job, Problem } from './types.ts';

/** Base class for every error thrown by the SDK. */
export class TypesearchError extends Error {
  override name = 'TypesearchError';
}

/**
 * The API answered with an error ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details).
 *
 * `code` is stable and meant for programs (`rate_limited`, `invalid_request`…); `message` is meant for
 * people and can change. `requestId` identifies the request: include it when you contact support.
 */
export class APIError extends TypesearchError {
  override name = 'APIError';
  /** The HTTP status. */
  readonly status: number;
  /** The stable error code, such as `invalid_request` or `rate_limited`. */
  readonly code: string;
  readonly requestId: string | null;
  /** One entry per invalid field, when the request was invalid. */
  readonly errors: FieldError[];
  /** The whole problem details object, as the API sent it. */
  readonly problem: Partial<Problem>;
  readonly headers: Headers;

  constructor(status: number, problem: Partial<Problem>, headers: Headers) {
    super(problem.detail || problem.title || `Request failed with status ${status}`);
    this.status = status;
    this.code = problem.code || 'unknown_error';
    this.requestId = problem.request_id || headers.get('x-request-id');
    this.errors = Array.isArray(problem.errors) ? problem.errors : [];
    this.problem = problem;
    this.headers = headers;
  }
}

/** 400: the request is malformed or a field is invalid (`errors` lists each one). */
export class BadRequestError extends APIError {
  override name = 'BadRequestError';
}

/** 401: the API key is missing, invalid or revoked. */
export class AuthenticationError extends APIError {
  override name = 'AuthenticationError';
}

/**
 * 402: `budget_too_small` (`max_tokens` is too small to judge even the headlines), `insufficient_credits`
 * (no credit left) or `spend_limit_reached` (the key hit its monthly limit).
 */
export class BudgetError extends APIError {
  override name = 'BudgetError';
}

/** 403: `robots_disallowed` (the site's robots.txt disallows it) or `source_unavailable`. */
export class PermissionDeniedError extends APIError {
  override name = 'PermissionDeniedError';
}

/** 404: the job does not exist for this key, or it expired (jobs last one day). */
export class NotFoundError extends APIError {
  override name = 'NotFoundError';
}

/** 429: the per-minute limit (`rate_limited`, retried) or the daily token quota (`quota_exceeded`, never retried). */
export class RateLimitError extends APIError {
  override name = 'RateLimitError';
  /** Seconds to wait, from `Retry-After`, when the server sent it. */
  readonly retryAfter: number | null;

  constructor(status: number, problem: Partial<Problem>, headers: Headers) {
    super(status, problem, headers);
    const ms = retryAfterMs(headers);
    this.retryAfter = ms === null ? null : Math.ceil(ms / 1000);
  }
}

/** 5xx: something failed on our side, or the site you asked for did. Retried automatically. */
export class InternalServerError extends APIError {
  override name = 'InternalServerError';
}

/** The request never got an answer: network failure, DNS, connection reset. */
export class APIConnectionError extends TypesearchError {
  override name = 'APIConnectionError';

  constructor(message = 'Could not reach the typesearch API.', options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** The request took longer than `timeout`, or a job did not finish within `waitTimeout`. */
export class APITimeoutError extends APIConnectionError {
  override name = 'APITimeoutError';
}

/** A live site search job ended in `failed`. The job, with its `error`, is in `job`. */
export class JobFailedError extends TypesearchError {
  override name = 'JobFailedError';
  readonly job: Job;
  /** The stable error code of the job, such as `site_unreachable`. */
  readonly code: string;

  constructor(job: Job) {
    super(job.error?.detail || `Job ${job.id} failed.`);
    this.job = job;
    this.code = job.error?.code || 'unknown_error';
  }
}

/** The right error class for an HTTP status. */
export function errorFor(status: number, problem: Partial<Problem>, headers: Headers): APIError {
  if (status === 400) return new BadRequestError(status, problem, headers);
  if (status === 401) return new AuthenticationError(status, problem, headers);
  if (status === 402) return new BudgetError(status, problem, headers);
  if (status === 403) return new PermissionDeniedError(status, problem, headers);
  if (status === 404) return new NotFoundError(status, problem, headers);
  if (status === 429) return new RateLimitError(status, problem, headers);
  if (status >= 500) return new InternalServerError(status, problem, headers);
  return new APIError(status, problem, headers);
}

/** `Retry-After` (seconds or an HTTP date) or `retry-after-ms`, in milliseconds; `null` if absent or unreadable. */
export function retryAfterMs(headers: Headers): number | null {
  const ms = Number(headers.get('retry-after-ms'));
  if (headers.get('retry-after-ms') !== null && Number.isFinite(ms) && ms >= 0) return ms;
  const value = headers.get('retry-after');
  if (value === null || value.trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : null;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}
