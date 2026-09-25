/**
 * Request and response types for the typesearch API (v1).
 *
 * Most of them are generated from the API's OpenAPI document (`generated.ts`), so field names and
 * descriptions match the HTTP API exactly (snake_case): https://typesearch.ai/docs/api-reference
 */
import type { SearchResponse } from './generated.ts';

export type * from './generated.ts';

/** The response of `similar()`: a search response with `object: "similar"` and `reference` set. */
export type SimilarResponse = SearchResponse;

/** The result of a live site search: a search response with `object: "site_search"` and `site` set. */
export type SiteSearchResponse = SearchResponse;

/** A step of a streamed search: judging headlines, reading articles, classifying tone… */
export interface Step {
  /** Stable id of the step, such as `juicio-indice`. Use it, and `status`, in code. */
  id: string;
  /** Meant for people; it can change. In English unless the request asks for Spanish (`Accept-Language: es`). */
  text: string;
  status: 'running' | 'done' | 'skipped' | 'failed';
  detail: string | null;
}

export interface StepEvent {
  type: 'step';
  step: Step;
}

/** Results judged so far. Each one is confirmed in place as its article is read. */
export interface PartialEvent {
  type: 'partial';
  response: SearchResponse;
}

/** The final result. The stream ends after it. */
export interface ResultEvent {
  type: 'result';
  response: SearchResponse;
}

/** An event of `searchStream()` or `siteSearchStream()`. An `error` event is thrown as an `APIError`. */
export type SearchStreamEvent = StepEvent | PartialEvent | ResultEvent;
