/**
 * The API client — the frontend's ONLY place that knows how to talk
 * to the backend.
 *
 * WHY one wrapper instead of fetch() in every component:
 * - relative '/api' base (the Vite/Nginx proxy from vite.config.js —
 *   this file is why components never hardcode localhost:4000)
 * - JSON parse + error extraction in ONE spot (components just try/catch)
 * - when Step 7 adds presigned S3 uploads, only this file grows —
 *   components never learn about it. Single responsibility, testable.
 */
const BASE = '/api';

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // components branch on 404 vs 500 etc.
    this.details = details; // validation messages from the backend
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // 204 No Content has no body — parsing it would throw on empty text.
  if (res.status === 204) return null;

  // Assume JSON, but don't trust it: Nginx error pages return HTML,
  // so a failed deploy can come back as a "200 OK" with an HTML body.
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON — fall through to the generic error below */
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed (${res.status})`,
      res.status,
      data?.details
    );
  }
  return data;
}

/* ---- typed helpers: components import these, never raw request() ---- */

export const listPosts = ({ limit = 20, offset = 0 } = {}) =>
  request(`/posts?limit=${limit}&offset=${offset}`);

export const getPost = (id) => request(`/posts/${id}`);

export const createPost = ({ title, description, image_key }) =>
  request('/posts', {
    method: 'POST',
    body: JSON.stringify({ title, description, image_key }),
  });

export const deletePost = (id) =>
  request(`/posts/${id}`, { method: 'DELETE' });

/* ---- Step 7: the S3 leg --------------------------------------------
 * TWO different network destinations now:
 *   presignUpload → OUR API (EC2)  — small JSON, gets permission
 *   putToS3       → S3 DIRECTLY    — the file bytes, skips EC2 entirely
 * The S3 URL is absolute (from the presign response) — our /api proxy
 * rules never apply to it; that's the whole architecture in two lines.
 */

export const presignUpload = (content_type, size_bytes) =>
  request('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ content_type, size_bytes }),
  });

/**
 * PUT the file straight to S3 with progress reporting.
 *
 * WHY XMLHttpRequest and not fetch(): fetch has NO upload-progress
 * event (a long-standing complaint). XHR's `upload.onprogress` does —
 * no library, no polyfill, works everywhere. This is a rare case where
 * the "old" API is the right tool.
 */
export function putToS3(uploadUrl, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(); // S3 returns 200 + ETag header on successful PUT
      } else {
        // S3 failures come back as XML — surface the raw status and
        // point at the two usual suspects (expired URL / wrong header).
        reject(
          new Error(
            `S3 rejected the upload (HTTP ${xhr.status}). ` +
              'Presigned URL may have expired, or Content-Type mismatch.'
          )
        );
      }
    };

    // Network-level failure = almost always the bucket CORS rule
    // (the browser reports it as opaque "error", not a status code).
    xhr.onerror = () =>
      reject(
        new Error(
          'Could not reach S3 at all — check the bucket CORS configuration (docs/aws-setup.md § 1).'
        )
      );

    // MUST match what the presign signed into the URL — S3 compares them.
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file); // File is a Blob — XHR streams it as the PUT body
  });
}

export { ApiError };
