/** Thrown inside handlers to return a specific HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, init);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
}

/** Wraps a handler so thrown HttpErrors become JSON error responses. */
export function handler(fn: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request);
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
