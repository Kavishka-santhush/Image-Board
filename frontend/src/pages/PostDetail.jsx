/**
 * PostDetail — fetches /api/posts/:id.
 *
 * NEW BRANCH vs Home: 404 gets its OWN state (`notFound`), separate
 * from generic errors. Why? "post #999 doesn't exist" and "backend is
 * down" need different UIs — one is a dead link, the other asks the
 * user to retry. err.status from our ApiError class makes this trivial;
 * a raw fetch wrapper that loses status codes would force string-matching.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deletePost, getPost } from '../api/client';
import PostImage from '../components/PostImage';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);

    getPost(id)
      .then((data) => {
        if (!cancelled) setPost(data.post);
      })
      .catch((err) => {
        if (cancelled) return;
        // status lives on the error thanks to our ApiError wrapper
        if (err.status === 404) setNotFound(true);
        else setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    // Browser-native confirm is fine for a learning app; production
    // apps use a modal, but the SAFETY IDEA (explicit user intent
    // before a destructive call) is identical.
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await deletePost(id);
      // Optimistic? No — wait for 204, THEN navigate. If delete failed
      // we'd have lied to the user about their data being gone.
      navigate('/');
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }

  if (loading) return <p className="loading">Loading post…</p>;

  if (notFound) {
    return (
      <section className="narrow center">
        <h1>Post {id} not found</h1>
        <p className="muted">It may have been deleted.</p>
        <Link to="/" className="btn btn-primary">
          Back home
        </Link>
      </section>
    );
  }

  if (error) {
    return (
      <section className="narrow center">
        <h1>Something broke 🥴</h1>
        <p className="muted">{error.message}</p>
      </section>
    );
  }

  return (
    <section className="narrow">
      <p>
        <Link to="/" className="muted">
          ← back to all posts
        </Link>
      </p>

      <article className="post-detail">
        <PostImage post={post} variant="tall" />

        <h1>{post.title}</h1>
        <p>{post.description}</p>

        <p className="muted" style={{ fontSize: '0.85rem' }}>
          created {new Date(post.created_at).toLocaleString()} · updated{' '}
          {new Date(post.updated_at).toLocaleString()}
        </p>

        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete post'}
        </button>
      </article>
    </section>
  );
}
