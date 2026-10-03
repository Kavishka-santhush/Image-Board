/**
 * PostCreate — the COMPLETE S3 story, three network calls:
 *
 *   1. POST /api/uploads/presign   → to EC2 (tiny JSON, gets permission)
 *   2. PUT  <presigned url>        → to S3 DIRECTLY (the big bytes —
 *      note the Network tab: this request's Server IP is AWS, not you;
 *      your micro instance never sees the file)
 *   3. POST /api/posts             → to EC2 again (now with the real
 *      key; backend verifies issued+uploaded+unused, see Step 6)
 *
 * Failure handling is deliberately staged: a CORS error in leg 2 is a
 * totally different diagnosis than a 400 in leg 3 — the `stage` state
 * drives both the button text and which error messages make sense.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost, presignUpload, putToS3 } from '../api/client';

export default function PostCreate() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState('idle'); // idle|presign|upload|save
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState([]);

  const busy = stage !== 'idle';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title || !file || busy) return;

    setErrors([]);
    setProgress(0);

    try {
      // ---- leg 1: ask our backend for permission ----
      setStage('presign');
      const presign = await presignUpload(file.type, file.size);
      // file.type comes from the OS file association — server re-validates
      // against its allowlist, so a lying client just gets a 400 here.

      // ---- leg 2: upload bytes straight to S3 ----
      setStage('upload');
      await putToS3(
        presign.upload_url,
        file,
        presign.required_headers['Content-Type'],
        setProgress
      );

      // ---- leg 3: create the post with the REAL issued key ----
      setStage('save');
      const { post } = await createPost({
        title,
        description,
        image_key: presign.key, // the key the server generated & issued
      });
      navigate(`/posts/${post.id}`);
    } catch (err) {
      setErrors(err.details || [err.message]);
      setStage('idle'); // stay editable — user can fix & retry
    }
  }

  const stageLabel = {
    idle: 'Publish',
    presign: 'Asking permission…',
    upload: `Uploading to S3… ${progress}%`,
    save: 'Saving to RDS…',
  }[stage];

  return (
    <section className="narrow">
      <h1>New post</h1>

      <form className="form" onSubmit={handleSubmit}>
        {errors.length > 0 && (
          <div className="form-errors">
            <strong>Fix these before retrying:</strong>
            <ul>
              {errors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <label>
          Title
          <input
            type="text"
            value={title}
            maxLength={140}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this picture about?"
            disabled={busy}
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            rows={4}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
            disabled={busy}
          />
        </label>

        {/* accept= limits the picker UI only — real validation is
            server-side in the presign handler (Step 6). */}
        <label>
          Image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files[0] || null)}
            disabled={busy}
          />
        </label>

        {file && (
          <p className="muted">
            Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}

        {stage === 'upload' && (
          <div className="progress-track" role="progressbar" aria-valuenow={progress}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={!title || !file || busy}>
          {stageLabel}
        </button>
      </form>
    </section>
  );
}
