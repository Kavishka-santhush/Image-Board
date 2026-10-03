/**
 * 404 page — catch-all route (*).
 *
 * WHY it matters extra in this project: in production, a wrong Nginx
 * config (missing try_files fallback) means users NEVER see this page —
 * they get an ugly server 404 on refresh instead. When this page DOES
 * appear after deploy, it proves Nginx + SPA routing both work.
 */
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="narrow center">
      <h1>404</h1>
      <p>That page doesn't exist on this board.</p>
      <Link to="/" className="btn btn-primary">
        Back home
      </Link>
    </section>
  );
}
