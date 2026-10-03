/**
 * App shell: persistent nav + <Outlet /> for the current page.
 *
 * React Router v6 layout pattern: routes below render INTO the
 * Outlet. The nav never re-mounts when navigating — that's why we
 * use NavLink (not <a>): <a> would trigger a full page reload and
 * blow away React state, defeating the point of an SPA.
 */
import { NavLink, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="app">
      <header className="navbar">
        <div className="navbar-brand">
          <NavLink to="/">📸 Image Board</NavLink>
        </div>
        <nav className="navbar-links">
          {/* `end` makes the Home link only "active" on exactly "/" —
              otherwise "/" matches every path and stays highlighted.
              Classic router gotcha, worth knowing. */}
          <NavLink to="/" end className="nav-link">
            Home
          </NavLink>
          <NavLink to="/posts/new" className="nav-link">
            + New Post
          </NavLink>
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        AWS learning pipeline — EC2 · RDS · S3 · Lambda · GitHub Actions
      </footer>
    </div>
  );
}
