/**
 * PostImage — one <img> component for cards AND detail pages.
 *
 * WHY the server-provided URLs (image_url / thumbnail_url):
 * Step 7's API decorates posts with display URLs (or null for
 * seed/manual keys that have no object). This component just trusts
 * that contract — no bucket knowledge in frontend code at all.
 *
 * THE onError FALLBACK matters: public-read on the bucket is an AWS
 * Console setting (docs/aws-setup.md § 4) — if it's misconfigured,
 * images 403 and the whole UI would look shattered. Degrading to the
 * placeholder turns "cryptic broken icons" into an obvious infra
 * question. Frontend resilience = part of the deploy story.
 *
 * loading="lazy": browser defers off-screen image loads — free perf,
 * one attribute. On a bare EC2 with no CDN, every saved byte counts.
 */
import { useState } from 'react';

export default function PostImage({ post, variant = 'card' }) {
  const [broken, setBroken] = useState(false);

  // Prefer the Lambda-generated thumbnail; fall back to the full image.
  // (While thumbnail_url is null but image_url set — pre-Lambda era —
  // we show the full one; cards crop via CSS object-fit.)
  const url = post.thumbnail_url || post.image_url;
  const cls = variant === 'tall' ? 'post-img tall' : 'post-img';

  if (!url || broken) {
    return (
      <div className={`img-placeholder ${variant === 'tall' ? 'tall' : ''}`}>
        {broken ? 'image not reachable — check bucket public-read policy' : 'no image uploaded yet'}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={post.title}
      className={cls}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
