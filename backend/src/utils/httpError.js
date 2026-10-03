/**
 * Error objects that carry an HTTP status (+ optional details array),
 * so deep validation code can `throw new HttpError(400, ...)` and the
 * central error handler in app.js turns it into the right response.
 * Way cleaner than threading res through every helper function.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

module.exports = { HttpError };
