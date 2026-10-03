/**
 * The Express app — defined WITHOUT calling listen().
 *
 * WHY split app from server: unit/integration tests (and later our CI
 * "test" stage) can import `app` and fire requests at it without
 * binding a port. Keeping "what the app does" separate from "where it
 * runs" is a standard Node layering habit worth learning early.
 */
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

app.use(cors()); // allows the React dev server (localhost:5173) to call us
app.use(express.json());

app.use('/api', routes);

// 404 handler — anything that didn't match a route above
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Central error handler — Express treats a 4-arg middleware as the
// "something threw" catcher. One place to log, one place to respond.
// HttpError (thrown from anywhere, see utils/httpError.js) carries its
// own status + details; anything else is a genuine 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const body = { error: err.message || 'Internal server error' };
  if (err.details) body.details = err.details; // validation lists, etc.
  res.status(err.status || 500).json(body);
});

module.exports = app;
