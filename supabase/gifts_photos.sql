-- 🎁 Gifts: up to three photos per gift instead of one.
--
-- Run this ONCE in the Supabase SQL editor. It is safe to run before or after
-- deploying the code: the app detects whether this column exists and falls
-- back to the single `url`/`path` pair when it doesn't, so nothing breaks in
-- the window between the two — the same rollout shape as the signed-URL work.
--
-- `url` and `path` are deliberately KEPT and still hold the first photo, so
-- rows written before this migration keep rendering and an older client
-- still shows something.

alter table gifts add column if not exists photos jsonb;

-- [{ "url": "...", "path": "gifts/abc.jpg" }, …] — at most 3, enforced in the
-- UI rather than here so a partial write can never wedge the row.
comment on column gifts.photos is
  'Up to 3 photos as [{url, path}]. url/path mirror the first for compatibility.';
