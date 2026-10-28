import { API_BASE_URL, API_TIMEOUT_MS, ENDPOINTS } from '../app/config';

// Normalized error so every page can render failures the same way.
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function extractMessage(body, status) {
  if (!body) return `Request failed with status ${status}.`;
  if (typeof body === 'string') return body.slice(0, 300);
  // FastAPI returns {detail: string | [{msg, loc}]}
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail.map((d) => `${(d.loc || []).join('.')}: ${d.msg}`).join('; ');
  }
  return body.message || body.error || `Request failed with status ${status}.`;
}

async function request(path, { method = 'GET', json, formData, timeoutMs = API_TIMEOUT_MS, signal } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onExternalAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onExternalAbort);

  const headers = { Accept: 'application/json' };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (formData) {
    body = formData; // browser sets the multipart boundary
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch (err) {
    if (signal?.aborted) throw new ApiError('Request was cancelled.', { code: 'cancelled' });
    if (controller.signal.aborted) {
      throw new ApiError(`The backend did not respond within ${Math.round(timeoutMs / 1000)}s.`, { code: 'timeout' });
    }
    throw new ApiError(`Cannot reach the backend at ${API_BASE_URL}. Is the FastAPI server running?`, {
      code: 'network',
      details: err?.message,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (response.status !== 204) {
    try {
      payload = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(extractMessage(payload, response.status), {
      status: response.status,
      code: response.status === 404 ? 'not_found' : response.status === 422 ? 'validation' : 'http_error',
      details: payload,
    });
  }
  if (payload !== null && typeof payload !== 'object') {
    throw new ApiError('The backend returned a non-JSON response.', { status: response.status, code: 'bad_response' });
  }
  return payload;
}

export const apiClient = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, json, opts) => request(path, { ...opts, method: 'POST', json }),
  patch: (path, json, opts) => request(path, { ...opts, method: 'PATCH', json }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (path, formData, opts) =>
    request(path, { timeoutMs: API_TIMEOUT_MS * 3, ...opts, method: 'POST', formData }),
};

export async function checkHealth() {
  const started = performance.now();
  const body = await apiClient.get(ENDPOINTS.health, { timeoutMs: 5000 });
  return { ok: true, latencyMs: Math.round(performance.now() - started), body };
}

export function toUserMessage(err) {
  if (!err) return 'Something went wrong.';
  return err.message || String(err);
}
