/**
 * Home — real data version (the SHELL_POSTS from Step 3 are gone).
 *
 * THE THREE STATES of any component that fetches data:
 *   loading → error → data (or empty)
 * Skipping the empty/error branches is why "it works but looks broken"
 * happens. We render all four branches below, always.
 *
 * THE CANCELLATION FLAG (`cancelled`) deserves attention:
 * StrictMode intentionally mounts the component TWICE in dev. Without
 * the cleanup below, both effect runs would fetch, and the slower one
 * could overwrite the newer result after unmount — React would also
 * warn about setState on an unmounted component. This tiny pattern is
 * the foundation of every correct data-fetching hook.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPosts } from '../api/client';
import PostImage from '../components/PostImage';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // "Reload counter": bumping `nonce` re-runs the effect below. One
  // fetch implementation, triggered by mount OR by the Retry button —
  // no duplicated request code. (React Query's refetch() is this idea,
  // industrialised.)
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await listPosts({ limit: 20 });
        if (!cancelled) {
          setPosts(data.posts);
          setMeta(data.meta);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Cleanup runs on unmount AND before every re-run (StrictMode's
    // double-mount included):
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  /* ---- branch 1: loading ---- */
  if (loading) return <p className="loading">Loading posts from RDS…</p>;

  /* ---- branch 2: error (backend down? RDS unreachable?) ---- */
  if (error) {
    return (
      <section className="narrow center">
        <h1>Something broke 🥴</h1>
        <p className="muted">{error.message}</p>
        <p className="muted">
          Is the backend running? Is RDS reachable? (That's the pipeline
          question Step 9 will answer automatically.)
        </p>
        <button className="btn btn-primary" onClick={() => setNonce((n) => n + 1)}>
          Retry
        </button>
      </section>
    );
  }

  /* ---- branch 3: empty (fresh DB, before seeding) ---- */
  if (posts.length === 0) {
    return (
      <section className="narrow center">
        <h1>No posts yet</h1>
        <p className="muted">Run `npm run seed:run` in backend/ — or be the first.</p>
        <Link to="/posts/new" className="btn btn-primary">
          + New Post
        </Link>
      </section>
    );
  }

  /* ---- branch 4: the happy path ---- */
  return (
    <section>
      <div className="page-head">
        <h1>
          Latest posts{' '}
          <span className="muted" style={{ fontSize: '0.9rem' }}>
            ({meta?.total ?? posts.length} total)
          </span>
        </h1>
        <Link to="/posts/new" className="btn btn-primary">
          + New Post
        </Link>
      </div>

      <div className="post-grid">
        {posts.map((post) => (
          <article key={post.id} className="post-card">
            <PostImage post={post} />
            <div className="post-card-body">
              <h2>
                <Link to={`/posts/${post.id}`}>{post.title}</Link>
              </h2>
              <p>{post.description}</p>
              <time className="muted">
                {new Date(post.created_at).toLocaleString()}
              </time>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
