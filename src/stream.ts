import { APIConnectionError, TypesearchError, errorFor } from './errors.ts';
import type { Problem, SearchResponse, SearchStreamEvent, Step } from './types.ts';

/** A Server-Sent Events message. */
export interface ServerSentEvent {
  event: string;
  data: string;
}

/** Splits a Server-Sent Events body into `{ event, data }` messages. Comments (`: …`) are skipped. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  let finished = false;

  /** Applies one line; returns a complete message when the line ends one. */
  const line = (text: string): ServerSentEvent | null => {
    if (text === '') {
      if (data.length === 0) {
        event = 'message';
        return null;
      }
      const message = { event, data: data.join('\n') };
      event = 'message';
      data = [];
      return message;
    }
    if (text.startsWith(':')) return null;
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    const raw = colon === -1 ? '' : text.slice(colon + 1);
    const value = raw.startsWith(' ') ? raw.slice(1) : raw;
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    return null;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r\n|\r|\n/.exec(buffer))) {
        // A trailing \r may be the first half of a \r\n split across chunks.
        if (!done && match[0] === '\r' && match.index === buffer.length - 1) break;
        const message = line(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
        if (message) yield message;
      }
      if (done) break;
    }
    finished = true;
    // A body that ends without a blank line still delivers its last message.
    const tail = (buffer ? line(buffer) : null) ?? line('');
    if (tail) yield tail;
  } finally {
    // Leaving early (a `break`, an error, an abort) closes the connection instead of reading it to the end.
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** @internal An open streaming response and what to release when it ends. */
export interface OpenStream {
  response: Response;
  release: () => void;
}

/**
 * A streamed search. Iterate it to receive events as they happen, or call `finalResponse()` to wait
 * for the complete result. The request starts when you start iterating.
 *
 * ```ts
 * for await (const event of ts.searchStream('el dólar', { mode: 'deep' })) {
 *   if (event.type === 'step') console.log('·', event.step.text);
 *   if (event.type === 'partial') render(event.response.results);
 *   if (event.type === 'result') render(event.response.results);
 * }
 * ```
 */
export class SearchStream implements AsyncIterable<SearchStreamEvent> {
  #open: () => Promise<OpenStream>;
  #consumed = false;
  #final: SearchResponse | null = null;

  /** @internal */
  constructor(open: () => Promise<OpenStream>) {
    this.#open = open;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SearchStreamEvent> {
    if (this.#consumed) throw new TypesearchError('A SearchStream can only be iterated once.');
    this.#consumed = true;
    const { response, release } = await this.#open();
    try {
      if (!response.body) throw new APIConnectionError('The API answered the stream without a body.');
      for await (const message of parseSSE(response.body)) {
        const payload = parse(message.data);
        if (message.event === 'step') {
          yield { type: 'step', step: payload as Step };
        } else if (message.event === 'partial') {
          yield { type: 'partial', response: payload as SearchResponse };
        } else if (message.event === 'result') {
          this.#final = payload as SearchResponse;
          yield { type: 'result', response: this.#final };
        } else if (message.event === 'error') {
          const problem = (payload ?? {}) as Partial<Problem>;
          throw errorFor(typeof problem.status === 'number' ? problem.status : 500, problem, response.headers);
        }
        // Other events are new in the API: ignored, so an older SDK keeps working.
      }
      if (!this.#final) throw new APIConnectionError('The stream ended before the final result.');
    } finally {
      release();
    }
  }

  /** Consumes the stream and resolves with the final result (the `result` event). */
  async finalResponse(): Promise<SearchResponse> {
    if (!this.#consumed) for await (const _ of this) void _;
    if (!this.#final) throw new APIConnectionError('The stream ended before the final result.');
    return this.#final;
  }
}

function parse(data: string): unknown {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (cause) {
    throw new TypesearchError(`The API sent an event that is not valid JSON: ${data.slice(0, 200)}`, { cause });
  }
}
