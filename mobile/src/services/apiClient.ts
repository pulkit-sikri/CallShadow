import { getApiBaseUrl } from './apiConfig';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Thread-safe / store-independent auth token holder
let currentAuthToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  currentAuthToken = token;
}

export function getApiAuthToken(): string | null {
  return currentAuthToken;
}

function formatErrorMessage(status: number, data: any): string {
  // Always prefer the backend's own detail message
  if (data) {
    if (typeof data.detail === 'string' && data.detail.length > 0) {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join('; ');
    }
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }
  }

  switch (status) {
    case 400:
      return 'Bad request — uploaded file may be empty or invalid.';
    case 401:
      return 'Session expired or invalid credentials. Please log in again.';
    case 403:
      return 'You do not have permission to access this resource.';
    case 404:
      return 'The requested resource was not found on the server.';
    case 409:
      return 'An account with this email already exists.';
    case 413:
      return 'Audio file is too large. Please use a file under 25 MB.';
    case 422:
      return 'Unsupported or corrupted audio format. Please use WAV, MP3, M4A, or FLAC.';
    case 500:
      return 'Server error during analysis. Check backend logs for details.';
    case 503:
      return 'Backend is temporarily unavailable. Please try again.';
    default:
      return `Server responded with status ${status}.`;
  }
}

/**
 * Wraps a fetch call with a timeout. Returns a rejected Promise if the timeout
 * expires before fetch resolves.
 */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs / 1000}s — backend may be busy processing audio.`));
    }, timeoutMs);

    fetch(url, options).then(
      (resp) => { clearTimeout(timer); resolve(resp); },
      (err)  => { clearTimeout(timer); reject(err); }
    );
  });
}

export const apiClient = {
  async get<T>(endpoint: string, customToken?: string): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const token = customToken || currentAuthToken;
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[API] GET ${url}`);

    try {
      const response = await fetchWithTimeout(url, { method: 'GET', headers }, 30000);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = formatErrorMessage(response.status, data);
        console.warn(`[API] GET ${url} → HTTP ${response.status}: ${msg}`);
        throw new ApiError(msg, response.status, data);
      }

      console.log(`[API] GET ${url} → HTTP ${response.status} OK`);
      return data as T;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      console.error(`[API] GET ${url} → Network error: ${error?.message}`);
      throw new ApiError(
        `Unable to reach backend (${baseUrl}). Check Wi-Fi or confirm server is running.`,
        0,
        error
      );
    }
  },

  async post<T>(endpoint: string, body?: any, customToken?: string): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const token = customToken || currentAuthToken;
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[API] POST ${url}`);

    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }, 30000);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = formatErrorMessage(response.status, data);
        console.warn(`[API] POST ${url} → HTTP ${response.status}: ${msg}`);
        throw new ApiError(msg, response.status, data);
      }

      console.log(`[API] POST ${url} → HTTP ${response.status} OK`);
      return data as T;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      console.error(`[API] POST ${url} → Network error: ${error?.message}`);
      throw new ApiError(
        `Unable to reach backend (${baseUrl}). Check Wi-Fi or confirm server is running.`,
        0,
        error
      );
    }
  },

  async upload<T>(endpoint: string, formData: FormData, customToken?: string): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const token = customToken || currentAuthToken;
    const url = `${baseUrl}${endpoint}`;

    // NOTE: Do NOT set Content-Type manually — React Native sets it with the correct
    // multipart boundary when body is a FormData instance.
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[API] UPLOAD POST ${url}`);
    console.log(`[API] Authorization header present: ${!!token}`);

    try {
      // 90-second timeout: CPU inference on a 10s clip can take 60+ seconds
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: formData,
      }, 90000);

      // Try to parse response body regardless of status for diagnostics
      let data: any = {};
      try {
        data = await response.json();
      } catch {
        const text = await response.text().catch(() => '');
        console.error(`[API] UPLOAD non-JSON response (HTTP ${response.status}): ${text.slice(0, 300)}`);
        data = { detail: `Server returned non-JSON response (HTTP ${response.status})` };
      }

      if (!response.ok) {
        const msg = formatErrorMessage(response.status, data);
        console.error(`[API] UPLOAD ${url} → HTTP ${response.status}: ${msg}`);
        console.error(`[API] UPLOAD raw detail: ${JSON.stringify(data).slice(0, 300)}`);
        throw new ApiError(msg, response.status, data);
      }

      console.log(`[API] UPLOAD ${url} → HTTP ${response.status} OK`);
      console.log(`[API] Response keys: ${Object.keys(data).join(', ')}`);
      return data as T;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      const errorMsg = error?.message || String(error);
      console.error(`[API] UPLOAD ${url} → Fetch error: ${errorMsg}`);
      // Re-throw with the actual underlying error message (timeout, ECONNREFUSED, etc.)
      throw new ApiError(
        `Upload failed: ${errorMsg}`,
        0,
        error
      );
    }
  },
};
