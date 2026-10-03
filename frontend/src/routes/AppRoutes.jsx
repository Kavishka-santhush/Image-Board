/**
 * Route table — lives in its own file so App.jsx stays a pure layout.
 *
 * WHY lazy() for pages: Vite code-splits each lazily-loaded page into
 * its own JS chunk. The initial download stays tiny — which matters on
 * a free-tier EC2 with no CDN in front of it. You can watch the chunks
 * appear in `npm run build` output and in the Network tab.
 *
 * Note the SPA deployment trap baked into our plan: refreshing /posts/3
 * in production hits Nginx, which must FALL BACK to index.html
 * (try_files ... /index.html) or you get a 404. We'll configure exactly
 * that in Step 10 — a classic "works in dev, breaks in prod" lesson.
 */
import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import App from '../App';

const Home = lazy(() => import('../pages/Home'));
const PostCreate = lazy(() => import('../pages/PostCreate'));
const PostDetail = lazy(() => import('../pages/PostDetail'));
const NotFound = lazy(() => import('../pages/NotFound'));

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Home />} />
        <Route path="posts/new" element={<PostCreate />} />
        <Route path="posts/:id" element={<PostDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
