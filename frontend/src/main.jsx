/**
 * React entry point.
 *
 * Router lives OUTSIDE App here — a common, explicit setup:
 * main.jsx decides the routing strategy (BrowserRouter = real URLs,
 * no hash), AppRoutes holds the route table, App.jsx is pure layout.
 */
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* StrictMode double-invokes effects in dev — annoying at first,
        but it catches exactly the kind of fetch/state bugs we'll hit
        in Steps 5 & 7. Keep it on. */}
    <BrowserRouter>
      {/* Suspense is REQUIRED around lazy() routes: it renders this
          fallback while a page chunk downloads on first navigation. */}
      <Suspense fallback={<p className="loading">Loading…</p>}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
