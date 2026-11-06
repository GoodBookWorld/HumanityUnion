import type {
  ExternalHttpRequest,
  ExternalHttpResponse,
} from "../../src/modules/public-news/public-news.fetch.js";

export interface FakeExternalResponse {
  status: number;
  body?: string | Buffer;
  headers?: Record<string, string>;
}

/** Builds a transport response whose body streams in chunks of at most `chunkSize` bytes. */
export function toExternalHttpResponse(
  fake: FakeExternalResponse,
  chunkSize = 64 * 1024,
): ExternalHttpResponse & { destroyed: () => boolean } {
  const payload = Buffer.isBuffer(fake.body) ? fake.body : Buffer.from(fake.body ?? "", "utf8");
  let destroyed = false;
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(fake.headers ?? {})) {
    headers[name.toLowerCase()] = value;
  }
  return {
    status: fake.status,
    headers,
    body: (async function* () {
      for (let offset = 0; offset < payload.length; offset += chunkSize) {
        if (destroyed) {
          return;
        }
        yield payload.subarray(offset, offset + chunkSize);
      }
    })(),
    destroy: () => {
      destroyed = true;
    },
    destroyed: () => destroyed,
  };
}

export type FakeTransportHandler = (
  request: ExternalHttpRequest,
) => FakeExternalResponse | Promise<FakeExternalResponse>;
