/**
 * uploadService.ts
 *
 * Robust audio file upload supporting Expo SDK 57 (File.upload)
 * and React Native native XMLHttpRequest multipart fallback.
 *
 * Handles file:// and content:// URIs returned by expo-document-picker and expo-audio.
 * Transmits binary multipart audio payload to FastAPI POST /api/audio/upload.
 */

import { File, UploadType, Paths } from 'expo-file-system';
import { getApiBaseUrl } from './apiConfig';
import { getApiAuthToken, ApiError } from './apiClient';

export interface AudioUploadOptions {
  /** Multipart field name — MUST match FastAPI's `file: UploadFile` parameter (default: 'file') */
  fieldName?: string;
  /** MIME type for the file part */
  mimeType?: string;
  /** Additional form fields to include in the multipart body */
  parameters?: Record<string, string>;
}

/**
 * Derive a MIME type from a URI's file extension.
 */
export function mimeFromUri(uri: string, fallback = 'audio/wav'): string {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
  const map: Record<string, string> = {
    wav:  'audio/wav',
    mp3:  'audio/mpeg',
    m4a:  'audio/m4a',
    mp4:  'audio/mp4',
    aac:  'audio/aac',
    flac: 'audio/flac',
    ogg:  'audio/ogg',
    webm: 'audio/webm',
    caf:  'audio/x-caf',
    amr:  'audio/amr',
  };
  return map[ext] || fallback;
}

/**
 * Validate that a URI is a valid path.
 */
function validateUri(uri: string): void {
  if (!uri || uri.trim().length === 0) {
    throw new Error(
      'No audio file selected. Please tap the upload zone to choose a file, then tap Analyze.'
    );
  }
  if (uri.startsWith('data:')) {
    throw new Error(
      'data: URIs cannot be uploaded directly. Please select a real audio file from your device.'
    );
  }
  if (
    !uri.startsWith('file://') &&
    !uri.startsWith('content://') &&
    !uri.startsWith('/') &&
    !uri.includes('/')
  ) {
    throw new Error(
      `"${uri}" does not look like a valid file path. ` +
      'Please select a file using the picker or finish a full recording before analyzing.'
    );
  }
}

/**
 * React Native XMLHttpRequest Multipart Upload Fallback
 * (Bypasses React 19 / RN 0.86 FormDataPart fetch limitation)
 */
function uploadViaXhr<T>(
  endpoint: string,
  uploadUri: string,
  fileName: string,
  mimeType: string,
  fieldName: string,
  headers: Record<string, string>,
  parameters: Record<string, string>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    console.log(`[UPLOAD-XHR] Starting POST to ${endpoint}`);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.timeout = 90000;

    Object.entries(headers).forEach(([key, val]) => {
      xhr.setRequestHeader(key, val);
    });

    const formData = new FormData();
    // React Native FormData format for local files
    formData.append(fieldName, {
      uri: uploadUri,
      name: fileName,
      type: mimeType,
    } as any);

    Object.entries(parameters).forEach(([key, val]) => {
      formData.append(key, val);
    });

    xhr.onload = () => {
      console.log(`[UPLOAD-XHR] HTTP ${xhr.status}`);
      let responseData: any = {};
      try {
        responseData = JSON.parse(xhr.responseText);
      } catch {
        responseData = { detail: xhr.responseText || `HTTP ${xhr.status}` };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(responseData as T);
      } else {
        const detail =
          (typeof responseData?.detail === 'string' && responseData.detail.length > 0
            ? responseData.detail
            : null) ||
          (Array.isArray(responseData?.detail)
            ? responseData.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
            : null) ||
          responseData?.message ||
          `Server responded with HTTP ${xhr.status}`;
        reject(new ApiError(detail, xhr.status, responseData));
      }
    };

    xhr.onerror = (e: any) => {
      console.error('[UPLOAD-XHR] Network error:', e);
      reject(new ApiError(`Upload request failed. Check server connection.`, 0, e));
    };

    xhr.ontimeout = () => {
      console.error('[UPLOAD-XHR] Request timed out (90s)');
      reject(new ApiError('Upload request timed out after 90s — backend busy processing.', 0));
    };

    xhr.send(formData);
  });
}

/**
 * Upload a local audio file to POST /api/audio/upload using Expo File.upload
 * with automatic XMLHttpRequest fallback.
 */
export async function uploadAudioFile<T = any>(
  fileUri: string,
  fileName: string,
  options: AudioUploadOptions = {}
): Promise<T> {
  const {
    fieldName = 'file',
    mimeType = mimeFromUri(fileUri),
    parameters = {},
  } = options;

  const baseUrl = getApiBaseUrl();
  const token = getApiAuthToken();
  const endpoint = `${baseUrl}/api/audio/upload`;

  console.log('[UPLOAD DEBUG]');
  console.log(`  uri:      ${fileUri.slice(0, 80)}`);
  console.log(`  name:     ${fileName}`);
  console.log(`  mimeType: ${mimeType}`);
  console.log(`  endpoint: ${endpoint}`);
  console.log(`  auth:     ${token ? 'YES (Bearer)' : 'NO TOKEN'}`);

  validateUri(fileUri);

  // Normalise content:// → file:// cache copy if needed
  let uploadUri = fileUri;
  if (fileUri.startsWith('content://')) {
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'wav';
    const safeExt = ext === 'mpeg' ? 'mp3' : ext === 'mp4' ? 'm4a' : ext;
    const destName = `upload_${Date.now()}.${safeExt}`;
    try {
      const sourceFile = new File(fileUri);
      const destFile = new File(Paths.cache, destName);
      sourceFile.copy(destFile);
      uploadUri = destFile.uri;
      console.log(`[UPLOAD] Copied content:// to cache: ${uploadUri}`);
    } catch (copyErr: any) {
      console.warn(`[UPLOAD] Cache copy notice (${copyErr?.message}), using original URI`);
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Strategy 1: Expo SDK 57 File.upload API
  try {
    const file = new File(uploadUri);
    console.log(`[UPLOAD] Attempting Expo File.upload on ${file.uri.slice(0, 60)}`);

    const uploadResult = await file.upload(endpoint, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName,
      mimeType,
      headers,
      parameters,
    });

    console.log(`[UPLOAD] Expo File.upload HTTP ${uploadResult.status}`);

    let responseData: any = {};
    try {
      responseData = JSON.parse(uploadResult.body);
    } catch {
      console.error(`[UPLOAD] Non-JSON body: ${uploadResult.body?.slice(0, 200)}`);
      responseData = { detail: `Server returned non-JSON (HTTP ${uploadResult.status})` };
    }

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      const detail =
        (typeof responseData?.detail === 'string' && responseData.detail.length > 0
          ? responseData.detail
          : null) ||
        (Array.isArray(responseData?.detail)
          ? responseData.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
          : null) ||
        responseData?.message ||
        `Server responded with HTTP ${uploadResult.status}`;

      console.error(`[UPLOAD] Error detail: ${detail}`);
      throw new ApiError(detail, uploadResult.status, responseData);
    }

    console.log(`[UPLOAD] Success. Keys: ${Object.keys(responseData).join(', ')}`);
    return responseData as T;
  } catch (fileUploadErr: any) {
    if (fileUploadErr instanceof ApiError && fileUploadErr.status > 0) {
      // Valid HTTP error response from server, do not fallback
      throw fileUploadErr;
    }
    console.warn(`[UPLOAD] Expo File.upload failed (${fileUploadErr?.message}), trying XMLHttpRequest fallback...`);
  }

  // Strategy 2: React Native XMLHttpRequest Fallback
  try {
    const result = await uploadViaXhr<T>(
      endpoint,
      uploadUri,
      fileName,
      mimeType,
      fieldName,
      headers,
      parameters
    );
    console.log(`[UPLOAD] XHR fallback success!`);
    return result;
  } catch (xhrErr: any) {
    if (xhrErr instanceof ApiError && xhrErr.status > 0) {
      throw xhrErr;
    }
    const msg = xhrErr?.message || String(xhrErr);
    console.error(`[UPLOAD] XHR upload error: ${msg}`);
    throw new ApiError(
      `Upload failed: ${msg}.\n\nEnsure backend is running at ${baseUrl}.`,
      0,
      xhrErr
    );
  }
}


