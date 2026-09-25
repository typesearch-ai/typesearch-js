// Generado por scripts/generate-types.mjs desde el OpenAPI de la API (1.0.0, a3cea60b7c89).
// No editar a mano: `npm run generate` (o `npm run generate -- --fetch` para traer el vivo).

/** Any JSON value. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface SearchRequest {
  /** One query, or up to 5 judged together. 1–5 items. */
  query: string | string[];
  /** Only these index sources, by domain, such as example.com. GET /v1/sources?domain=… tells you whether a domain is covered. 1–100 items. */
  sources?: string[];
  /** Only these domains or paths. A domain includes its subdomains. At most 20 items. */
  include_domains?: string[];
  /** Never these domains or paths. At most 20 items. */
  exclude_domains?: string[];
  /** Only these sections: the section in the feed, or the start of the URL path. At most 20 items. */
  sections?: string[];
  /** The last N days; null for the whole index. Defaults to 7 unless dates are given. 1–365. */
  days?: number | null;
  /** Published on or after this date. A bare date is read in Argentina time (UTC−3). */
  published_after?: string;
  /** Published on or before this date; a bare date includes that whole day. */
  published_before?: string;
  /** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. Defaults to `"normal"`. */
  mode?: Mode;
  /** 1–50. Defaults to `10`. */
  max_results?: number;
  /** Very short verbatim excerpts (up to 25 words, never from the first paragraph) from the articles that were read: one per article, two in deep mode. On by default only in deep mode. */
  highlights?: boolean;
  /** Groups the same story reported by several outlets. Defaults to `false`. */
  dedupe?: boolean;
  /** Tone toward the query: positive, neutral or negative. Defaults to `false`. */
  tone?: boolean;
  /** The essentials: very short verbatim excerpts across several articles. On by default only in deep mode. */
  essential?: boolean;
  /** Structured output: typed questions (boolean, choice, score) that the model answers for each result. */
  questions?: Record<string, Question>;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
  /** Skips the result cache (10 minutes). Defaults to `false`. */
  fresh?: boolean;
  /** auto: a date in the query («today», «yesterday», «tomorrow», «on September 22», «this week») is taken out of the topic, sets the publication window (unless published_after/before are given; days only bounds it) and puts the results from that day first · off: the query is taken literally. Defaults to `"auto"`. */
  temporal?: "auto" | "off";
  /** IANA time zone that decides what day «today» is. Defaults to Argentina (America/Argentina/Buenos_Aires). */
  timezone?: string;
  /** Server-sent events while it searches: step, partial, result. Defaults to `false`. */
  stream?: boolean;
}

/** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. */
export type Mode = "ultra" | "fast" | "normal" | "deep";

export type Question = BooleanQuestion | ChoiceQuestion | ScoreQuestion;

export interface BooleanQuestion {
  type: "boolean";
  instructions: string | Record<string, JsonValue> | JsonValue[];
  criteria?: BooleanCriteria;
}

export interface BooleanCriteria {
  true?: string;
  false?: string;
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: string | Record<string, JsonValue> | JsonValue[];
  criteria: Record<string, string | null>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: string | Record<string, JsonValue> | JsonValue[];
  /** At least 2 items. */
  criteria: string[];
}

export interface SimilarRequest {
  url: string;
  /** Only these index sources, by domain, such as example.com. GET /v1/sources?domain=… tells you whether a domain is covered. 1–100 items. */
  sources?: string[];
  /** Only these domains or paths. A domain includes its subdomains. At most 20 items. */
  include_domains?: string[];
  /** Never these domains or paths. At most 20 items. */
  exclude_domains?: string[];
  /** Only these sections: the section in the feed, or the start of the URL path. At most 20 items. */
  sections?: string[];
  /** The last N days; null for the whole index. Defaults to 7 unless dates are given. 1–365. */
  days?: number | null;
  /** Published on or after this date. A bare date is read in Argentina time (UTC−3). */
  published_after?: string;
  /** Published on or before this date; a bare date includes that whole day. */
  published_before?: string;
  /** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. Defaults to `"normal"`. */
  mode?: Mode;
  /** 1–50. Defaults to `10`. */
  max_results?: number;
  /** Very short verbatim excerpts (up to 25 words, never from the first paragraph) from the articles that were read: one per article, two in deep mode. On by default only in deep mode. */
  highlights?: boolean;
  /** Groups the same story reported by several outlets. Defaults to `false`. */
  dedupe?: boolean;
  /** Tone toward the query: positive, neutral or negative. Defaults to `false`. */
  tone?: boolean;
  /** The essentials: very short verbatim excerpts across several articles. On by default only in deep mode. */
  essential?: boolean;
  /** Structured output: typed questions (boolean, choice, score) that the model answers for each result. */
  questions?: Record<string, Question>;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
  /** Skips the result cache (10 minutes). Defaults to `false`. */
  fresh?: boolean;
  /** auto: a date in the query («today», «yesterday», «tomorrow», «on September 22», «this week») is taken out of the topic, sets the publication window (unless published_after/before are given; days only bounds it) and puts the results from that day first · off: the query is taken literally. Defaults to `"auto"`. */
  temporal?: "auto" | "off";
  /** IANA time zone that decides what day «today» is. Defaults to Argentina (America/Argentina/Buenos_Aires). */
  timezone?: string;
}

export interface SiteSearchRequest {
  /** The live site to search, such as example.com. */
  site: string;
  query: string;
  /** Only these sections: the section in the feed, or the start of the URL path. At most 20 items. */
  sections?: string[];
  /** Never these domains or paths. At most 20 items. */
  exclude_domains?: string[];
  /** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. Defaults to `"normal"`. */
  mode?: Mode;
  /** 1–50. Defaults to `10`. */
  max_results?: number;
  /** Very short verbatim excerpts (up to 25 words, never from the first paragraph) from the articles that were read: one per article, two in deep mode. On by default only in deep mode. */
  highlights?: boolean;
  /** Groups the same story reported by several outlets. Defaults to `false`. */
  dedupe?: boolean;
  /** Tone toward the query: positive, neutral or negative. Defaults to `false`. */
  tone?: boolean;
  /** The essentials: very short verbatim excerpts across several articles. On by default only in deep mode. */
  essential?: boolean;
  /** Structured output: typed questions (boolean, choice, score) that the model answers for each result. */
  questions?: Record<string, Question>;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
  /** Skips the result cache (10 minutes). Defaults to `false`. */
  fresh?: boolean;
  /** auto: a date in the query («today», «yesterday», «tomorrow», «on September 22», «this week») is taken out of the topic, sets the publication window (unless published_after/before are given; days only bounds it) and puts the results from that day first · off: the query is taken literally. Defaults to `"auto"`. */
  temporal?: "auto" | "off";
  /** IANA time zone that decides what day «today» is. Defaults to Argentina (America/Argentina/Buenos_Aires). */
  timezone?: string;
  /** Server-sent events instead of an asynchronous job. Defaults to `false`. */
  stream?: boolean;
}

export interface ContentsRequest {
  /** 1–10 items. */
  urls: string[];
  /** With a query, the model picks the excerpt about it and says how much each article covers it. */
  query?: string;
  /** Defaults to `true`. */
  highlights?: boolean;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
}

export interface SearchResponse {
  /** The request id, also in the `X-Request-Id` header. */
  id: string;
  object: "search" | "site_search" | "similar";
  mode: Mode;
  queries: string[];
  /** Whether any result scored 0.5 or more. */
  found: boolean;
  /** How many relevant articles exist; it can be more than `max_results`. */
  total: number;
  /** The relevant articles, most relevant first. */
  results: Result[];
  /** With several queries: the breakdown for each one. */
  groups: QueryGroup[] | null;
  /** If nothing was found: the closest matches. */
  near_misses: Result[];
  /** The headline looked relevant, but reading the article ruled it out. */
  rejected: Result[];
  /** Articles per day and per source, and who published first. */
  diffusion: Diffusion | null;
  /** Tone counts overall and by source, when `tone: true`. */
  tone: ToneSummary | null;
  /** Up to three verbatim excerpts that capture the story, when `essential` is on. */
  essential: Essential | null;
  /** The reference article, in a `similar` response. */
  reference: Reference | null;
  /** How the date in the query was read: the topic was judged without it, and the results from that day go first. Null when the query names none. */
  temporal: QueryDate | null;
  /** The site searched, in a live site search. */
  site: string | null;
  index: IndexInfo | null;
  /** Model tokens, calls, time and what this request was billed (`cost_usd`). */
  usage: SearchUsage;
  /** The `max_tokens` cap and how much of it was used. */
  budget: Budget | null;
  /** Discovery: when the index has fewer than 3 good matches, typesearch looks for sources beyond it and reads them at the original site. Null only in partial events, while it is still running. */
  discovery: Discovery | null;
  /** The token cap (max_tokens) or the discovery time budget ran out: there may be more. */
  incomplete: boolean;
  /** When the cached result was computed; `null` if it was computed now. */
  cached_at: string | null;
  /** Things that did not stop the request, such as a domain that is not indexed. */
  warnings: ResponseWarning[];
}

export interface Result {
  /** The article URL. */
  url: string;
  /** The headline. */
  title: string;
  /** The outlet that published it. */
  source: string | null;
  /** Publication date-time (ISO 8601, UTC), when known. */
  published_at: string | null;
  /** The section the outlet declares, or the first segment of the URL path. */
  section: string | null;
  /** The standfirst or description, as the outlet published it. */
  snippet: string | null;
  /** Probability that the article is about the query: from reading it if it was read, otherwise from its headline. */
  score: number;
  /** Probability that the headline alone is about the query. */
  headline_relevance: number;
  /** Set when the article was opened and read: its probability and how central the topic is (0–3). */
  read: Reading | null;
  /** Short verbatim excerpts about the query (up to 25 words), from articles that were read. */
  highlights: string[];
  /** Tone relative to the query, when `tone: true`. */
  tone: ResultTone | null;
  /** Answers to your `questions`, when you asked some. */
  answers: Answers | null;
  /** The same story from other outlets, when `dedupe: true`. */
  duplicates: Duplicate[];
  /** When the query names a date: whether the article is about that day (exact), the day before or after (adjacent), cannot tell (unknown) or another date (outside). Null otherwise. */
  date_match: "exact" | "adjacent" | "unknown" | "outside" | null;
  /** When the query names a date: the day the article is about (YYYY-MM-DD, in the request time zone), from its headline, its publication date or reading it. */
  referenced_date: string | null;
  /** Where it was found: the index; a live site (homepage, section, site_search); or discovery, a source beyond the index read at the original site for this request. */
  found_in: "index" | "homepage" | "section" | "site_search" | "discovery";
  /** With several queries: which ones this result belongs to. */
  queries?: string[];
}

export interface Reading {
  probability: number;
  /** 0 not mentioned · 3 main topic. */
  centrality: number;
}

export interface ResultTone {
  label: "positive" | "neutral" | "negative";
  probabilities: Record<"positive" | "neutral" | "negative", number>;
  basis: "article" | "headline";
}

export interface Answers {
  basis: "article" | "headline";
  values: Record<string, Answer>;
}

export type Answer = BooleanAnswer | ChoiceAnswer | ScoreAnswer;

export interface BooleanAnswer {
  type: "boolean";
  probability: number;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface Duplicate {
  url: string;
  title: string;
  source: string | null;
}

export interface QueryGroup {
  query: string;
  found: boolean;
  total: number;
  results: Result[];
  near_misses: Result[];
  rejected: Result[];
  diffusion: Diffusion | null;
  tone: ToneSummary | null;
  essential: Essential | null;
  /** How the date in the query was read: the topic was judged without it, and the results from that day go first. Null when the query names none. */
  temporal: QueryDate | null;
}

export interface Diffusion {
  by_day: DiffusionDay[];
  by_source: DiffusionSource[];
  first: FirstPublication | null;
  undated: number;
}

export interface DiffusionDay {
  day: string;
  count: number;
}

export interface DiffusionSource {
  source: string;
  count: number;
  first_published_at: string;
}

export interface FirstPublication {
  source: string | null;
  url: string;
  title: string;
  published_at: string;
}

export interface ToneSummary {
  articles: number;
  overall: ToneCounts;
  by_source: SourceTone[];
}

export interface ToneCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export interface SourceTone {
  positive: number;
  neutral: number;
  negative: number;
  source: string;
}

export interface Essential {
  excerpts: EssentialExcerpt[];
}

export interface EssentialExcerpt {
  text: string;
  url: string;
  source: string | null;
  title: string;
}

export interface QueryDate {
  /** The date words in the query, such as «hoy»; null when the query asks for the latest without naming a date. */
  expression: string | null;
  /** First day of the period the query refers to (YYYY-MM-DD, in `timezone`). */
  from: string | null;
  /** Last day of that period; the same as `from` for a single day. */
  to: string | null;
  timezone: string;
  /** published: what was published about that day · event: news about what is scheduled for that day (published before it) · recency: the query asks for the latest without naming a date, so the newest go first. */
  basis: "published" | "event" | "recency";
  /** The publication window the date set, when it did. Null when published_after/before (or days) in the request took precedence: then the date only sorts. */
  window: DateWindow | null;
  /** No result is from the requested day: they come from the days around it. */
  widened: boolean;
}

export interface DateWindow {
  from: string;
  to: string;
}

export interface Reference {
  url: string;
  title: string;
}

export interface IndexInfo {
  sources: number;
  articles: number;
  updated_at: string | null;
}

export interface SearchUsage {
  /** Model tokens used by this request. 0 when it came from the cache. */
  tokens: number;
  calls: number;
  /** What this request was billed, in USD: the list price of its mode (see `pricing` in GET /v1/usage), per query. 0 when it came from the cache. Null in partial results. */
  cost_usd: number | null;
  headlines: number;
  from_memory: number;
  pages_direct: number;
  pages_browser: number;
  duration_ms: number;
}

export interface Budget {
  max_tokens: number;
  used: number;
  exhausted: boolean;
}

export interface Discovery {
  /** used: it searched beyond the index within the time budget · background: in ultra or fast there was nothing to check quickly; it keeps learning in the background · skipped: the index had enough, or it does not apply · budget: the discovery limit was reached · timeout: the time budget ran out (incomplete: true). */
  status: "used" | "background" | "skipped" | "budget" | "timeout";
  /** Sites beyond the index that contributed candidates. */
  sites: number;
  /** Time it added to this request, in milliseconds. */
  ms: number;
}

export interface ResponseWarning {
  code: string;
  message: string;
}

export interface ContentsResponse {
  id: string;
  object: "contents";
  results: ContentsResult[];
  usage: ContentsUsage;
}

export interface ContentsResult {
  url: string;
  /** `ok`, or `error` with the reason in `error`. One URL failing never fails the request. */
  status: "ok" | "error";
  error: ContentsError | null;
  title: string | null;
  description: string | null;
  published_at: string | null;
  source: string | null;
  /** A very short verbatim excerpt (up to 25 words), never from the first paragraph: the one about the query if there is one. Null when the article can’t be quoted (short, paid, or the publisher asked for no snippets). */
  excerpt: string | null;
  highlights: string[];
  /** With query: probability that the article is about it. */
  relevance: number | null;
}

export type ContentsError = ResponseWarning;

export interface ContentsUsage {
  /** Model tokens used by this request. 0 when it came from the cache. */
  tokens: number;
  calls: number;
  /** What this request was billed, in USD: the list price of its mode (see `pricing` in GET /v1/usage), per query. 0 when it came from the cache. Null in partial results. */
  cost_usd: number | null;
  duration_ms: number;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  request_id: string;
  errors?: FieldError[];
}

export interface FieldError {
  path: string;
  message: string;
}

export interface Job {
  id: string;
  object: "job";
  /** `queued`, `running`, `succeeded` (with `result`) or `failed` (with `error`). */
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  finished_at: string | null;
  /** The search response, once the job succeeded. */
  result: SearchResponse | null;
  /** The problem details, if the job failed. */
  error: Problem | null;
}

export interface Sources {
  object: "sources";
  /** The oldest last ingestion across the index: its freshness is that of its most stale source. */
  updated_at: string | null;
  /** Sources in the index. */
  total: number;
  /** Articles in the whole index. */
  articles: number;
  by_country: CountryCoverage[];
  by_language: LanguageCoverage[];
}

export interface CountryCoverage {
  /** ISO 3166 alpha-2; null for international sources. */
  country: string | null;
  sources: number;
}

export interface LanguageCoverage {
  /** ISO 639-1. */
  language: string;
  sources: number;
}

export interface Source {
  object: "source";
  domain: string;
  /** Whether the domain is in the index and available. */
  covered: boolean;
  name?: string | null;
  country?: string | null;
  languages?: string[];
  articles?: number;
  last_refreshed_at?: string | null;
}

export interface Usage {
  object: "usage";
  key: UsageKey;
  limits: UsageLimits;
  /** Since 00:00 UTC. */
  today: UsageToday;
  last_30_days: UsagePeriod;
  /** The organization credit behind this key. Null for internal keys, which are not billed. */
  credit: Credit | null;
  /** The list prices: per 1,000 requests for each search mode, similar and live site search (each query in a multi-query request is one search of its mode), and per 1,000 pages for contents. */
  pricing: Pricing;
}

export interface UsageKey {
  id: string;
  name: string;
}

export interface UsageLimits {
  tokens_per_day: number;
  requests_per_minute: number;
  requests_per_second: number | null;
}

export interface UsageToday {
  requests: number;
  tokens: number;
  cost_usd: number;
  remaining_tokens: number;
}

export interface UsagePeriod {
  requests: number;
  tokens: number;
  cost_usd: number;
}

export interface Credit {
  balance_usd: number;
  plan: "payg" | "plan";
  spent_this_month_usd: number;
  monthly_limit_usd: number | null;
}

/** The list prices: per 1,000 requests for each search mode, similar and live site search (each query in a multi-query request is one search of its mode), and per 1,000 pages for contents. */
export interface Pricing {
  currency: "USD";
  per_1000_requests: RequestPricing;
  per_1000_pages: PagePricing;
}

export interface RequestPricing {
  ultra: number;
  fast: number;
  normal: number;
  deep: number;
  similar: number;
  /** Similar in deep mode, which reads eight articles with highlights (on Exa: findSimilar plus text and highlights for eight pages). */
  similar_deep: number;
  site_search: number;
}

export interface PagePricing {
  contents: number;
  /** With a query, the model reads each page and picks the excerpts. */
  contents_with_query: number;
}

/** Options for `search()` and `searchStream()`: every field of `POST /v1/search` but `query`. */
export interface SearchOptions {
  /** Only these index sources, by domain, such as example.com. GET /v1/sources?domain=… tells you whether a domain is covered. 1–100 items. */
  sources?: string[];
  /** Only these domains or paths. A domain includes its subdomains. At most 20 items. */
  include_domains?: string[];
  /** Never these domains or paths. At most 20 items. */
  exclude_domains?: string[];
  /** Only these sections: the section in the feed, or the start of the URL path. At most 20 items. */
  sections?: string[];
  /** The last N days; null for the whole index. Defaults to 7 unless dates are given. 1–365. */
  days?: number | null;
  /** Published on or after this date. A bare date is read in Argentina time (UTC−3). */
  published_after?: string | Date;
  /** Published on or before this date; a bare date includes that whole day. */
  published_before?: string | Date;
  /** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. Defaults to `"normal"`. */
  mode?: Mode;
  /** 1–50. Defaults to `10`. */
  max_results?: number;
  /** Very short verbatim excerpts (up to 25 words, never from the first paragraph) from the articles that were read: one per article, two in deep mode. On by default only in deep mode. */
  highlights?: boolean;
  /** Groups the same story reported by several outlets. Defaults to `false`. */
  dedupe?: boolean;
  /** Tone toward the query: positive, neutral or negative. Defaults to `false`. */
  tone?: boolean;
  /** The essentials: very short verbatim excerpts across several articles. On by default only in deep mode. */
  essential?: boolean;
  /** Structured output: typed questions (boolean, choice, score) that the model answers for each result. */
  questions?: Record<string, Question>;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
  /** Skips the result cache (10 minutes). Defaults to `false`. */
  fresh?: boolean;
  /** auto: a date in the query («today», «yesterday», «tomorrow», «on September 22», «this week») is taken out of the topic, sets the publication window (unless published_after/before are given; days only bounds it) and puts the results from that day first · off: the query is taken literally. Defaults to `"auto"`. */
  temporal?: "auto" | "off";
  /** IANA time zone that decides what day «today» is. Defaults to Argentina (America/Argentina/Buenos_Aires). */
  timezone?: string;
}

/** Options for `similar()`: every field of `POST /v1/similar` but `url`. */
export interface SimilarOptions {
  /** Only these index sources, by domain, such as example.com. GET /v1/sources?domain=… tells you whether a domain is covered. 1–100 items. */
  sources?: string[];
  /** Only these domains or paths. A domain includes its subdomains. At most 20 items. */
  include_domains?: string[];
  /** Never these domains or paths. At most 20 items. */
  exclude_domains?: string[];
  /** Only these sections: the section in the feed, or the start of the URL path. At most 20 items. */
  sections?: string[];
  /** The last N days; null for the whole index. Defaults to 7 unless dates are given. 1–365. */
  days?: number | null;
  /** Published on or after this date. A bare date is read in Argentina time (UTC−3). */
  published_after?: string | Date;
  /** Published on or before this date; a bare date includes that whole day. */
  published_before?: string | Date;
  /** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. Defaults to `"normal"`. */
  mode?: Mode;
  /** 1–50. Defaults to `10`. */
  max_results?: number;
  /** Very short verbatim excerpts (up to 25 words, never from the first paragraph) from the articles that were read: one per article, two in deep mode. On by default only in deep mode. */
  highlights?: boolean;
  /** Groups the same story reported by several outlets. Defaults to `false`. */
  dedupe?: boolean;
  /** Tone toward the query: positive, neutral or negative. Defaults to `false`. */
  tone?: boolean;
  /** The essentials: very short verbatim excerpts across several articles. On by default only in deep mode. */
  essential?: boolean;
  /** Structured output: typed questions (boolean, choice, score) that the model answers for each result. */
  questions?: Record<string, Question>;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
  /** Skips the result cache (10 minutes). Defaults to `false`. */
  fresh?: boolean;
  /** auto: a date in the query («today», «yesterday», «tomorrow», «on September 22», «this week») is taken out of the topic, sets the publication window (unless published_after/before are given; days only bounds it) and puts the results from that day first · off: the query is taken literally. Defaults to `"auto"`. */
  temporal?: "auto" | "off";
  /** IANA time zone that decides what day «today» is. Defaults to Argentina (America/Argentina/Buenos_Aires). */
  timezone?: string;
}

/** Options for `siteSearch()`: every field of `POST /v1/search/site` but `site` and `query`. */
export interface SiteSearchOptions {
  /** Only these sections: the section in the feed, or the start of the URL path. At most 20 items. */
  sections?: string[];
  /** Never these domains or paths. At most 20 items. */
  exclude_domains?: string[];
  /** ultra: headlines only · fast: headlines and standfirsts (these two cost the least, the same) · normal: reads the best matches · deep: more headlines, the topic also in other words (synonyms and acronyms), twice the reading, snippets and the essentials of each article, and the search of the sites that cover the topic when the index falls short. Defaults to `"normal"`. */
  mode?: Mode;
  /** 1–50. Defaults to `10`. */
  max_results?: number;
  /** Very short verbatim excerpts (up to 25 words, never from the first paragraph) from the articles that were read: one per article, two in deep mode. On by default only in deep mode. */
  highlights?: boolean;
  /** Groups the same story reported by several outlets. Defaults to `false`. */
  dedupe?: boolean;
  /** Tone toward the query: positive, neutral or negative. Defaults to `false`. */
  tone?: boolean;
  /** The essentials: very short verbatim excerpts across several articles. On by default only in deep mode. */
  essential?: boolean;
  /** Structured output: typed questions (boolean, choice, score) that the model answers for each result. */
  questions?: Record<string, Question>;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
  /** Skips the result cache (10 minutes). Defaults to `false`. */
  fresh?: boolean;
  /** auto: a date in the query («today», «yesterday», «tomorrow», «on September 22», «this week») is taken out of the topic, sets the publication window (unless published_after/before are given; days only bounds it) and puts the results from that day first · off: the query is taken literally. Defaults to `"auto"`. */
  temporal?: "auto" | "off";
  /** IANA time zone that decides what day «today» is. Defaults to Argentina (America/Argentina/Buenos_Aires). */
  timezone?: string;
}

/** Options for `contents()`: every field of `POST /v1/contents` but `urls`. */
export interface ContentsOptions {
  /** With a query, the model picks the excerpt about it and says how much each article covers it. */
  query?: string;
  /** Defaults to `true`. */
  highlights?: boolean;
  /** Cap on model tokens. If it is reached, the response comes back with incomplete: true. At least 2000. */
  max_tokens?: number | null;
}
