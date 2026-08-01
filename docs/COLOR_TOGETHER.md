# Color Together — Product and Technical Direction

Status: proposed direction, not yet implemented.

## One-sentence version

Lucia or Riu uploads a personal photo, AI turns it into a sophisticated
Impressionist paint-by-number picture with organic closed regions, both phones
fill the numbered colors together, and the completed work moves into a shared
Art Gallery.

## Product intent

This is collaborative creativity without requiring either person to draw.
Riu should never need to trace a line or choose the right shade: select a
numbered color, find a region carrying that number, and tap it. Lucia can use
the same simple interaction while still getting a detailed finished picture.

The experience should feel suitable for a teenager or adult, not like a
preschool coloring game. The visual reference is a dense hand-drawn coloring
book: flowers, leaves, faces, clothing, architecture, water and background
shapes become individual organic regions. A square or pixel grid is explicitly
not the product.

## Decisions already made

- **Placement:** a `🎨 Color Together` chip inside the existing Games chooser.
  The bottom navigation is full; this is not a sixth nav tab.
- **Drawing style:** mature Impressionist-inspired compositions with expressive
  contours and organic sections. The UI may offer themes such as countries,
  under the sea, flowers, travel, cafés and couple photos.
- **Interaction:** paint by number. Every region has one required palette
  number. A correct fill colors the region and removes its number.
- **Geometry:** regions follow the subject. Petals, leaves, faces, sky shapes,
  clothing folds and architectural details are sections; square tiles are not.
- **Canvas:** pinch/slider zoom and pan must not disable coloring. A tap while
  zoomed still resolves the correct region.
- **Shared result:** Lucia and Riu work on the same artwork. The app records who
  completed each region but the required color is fixed, so simultaneous taps
  cannot create conflicting colors.
- **Completion:** a finished work celebrates, becomes read-only by default and
  appears in `Our Art Gallery`. Reopening it for edits requires confirmation.
- **Custom photos:** generation is an online enhancement. The API key never
  ships to the browser.

## Primary flow

1. Open `🎮 Games` → `🎨 Color Together`.
2. Continue the active shared canvas, open the gallery, or choose `Make one`.
3. Upload a photo and crop it to portrait, square or landscape.
4. Choose complexity (`Relaxed`, `Detailed`, `Very detailed`) and palette size
   (8, 12 or 16 colors).
5. Confirm that the photo will be sent to the configured image-generation
   provider.
6. Wait on a generation screen that cannot be submitted twice accidentally.
7. Review the generated blank page and its colored reference.
8. Choose `Use this`, `Make simpler`, `Make more detailed` or `Try again`.
9. Color together. Select a numbered swatch, zoom/pan and tap matching regions.
10. On the last region, celebrate and save the rendered preview to the gallery.

Generation never silently publishes. The review step is also the escape hatch
for an AI result that technically passes validation but is not cute.

## Artwork contract

The AI output is an intermediate source, not the game data. A generation is
acceptable only when it satisfies all of these:

- The uploaded subject and composition remain recognizable.
- The look is sophisticated Impressionist paint-by-number, not a childlike
  cartoon and not a square mosaic.
- The design uses a small flat palette with no gradients or photographic
  texture inside a region.
- Contours are dark, confident and continuous.
- Every intended fill area is fully enclosed.
- Regions do not self-intersect and do not geometrically overlap other regions.
- Adjacent regions may share a boundary; foreground objects may visually cover
  background objects in the usual illustration sense.
- Sections are large enough to tap after zooming. Tiny decorative marks should
  be non-fillable line work or merged into a neighboring region.
- The generated source contains no printed words or numbers. The app assigns
  numbers itself so they are accurate and remain crisp at every zoom level.

The default prompt should describe the movement and structural requirements,
not request a copy of a particular reference image. A starting form:

> Preserve the subjects, pose, composition and recognizable details of the
> uploaded photo. Reinterpret it as a sophisticated Impressionist
> paint-by-number illustration for a teenager or adult. Use 12 flat colors,
> organic fully enclosed regions, graceful hand-drawn dark contours and
> medium-to-fine detail. No squares, grid, gradients, shading, photographic
> texture, words or printed numbers. Every fill region must be closed and large
> enough to color on a phone.

Complexity changes measurable constraints as well as prompt wording:

| Mode | Target regions | Minimum region area | Palette |
|---|---:|---:|---:|
| Relaxed | 40–90 | 0.12% of canvas | 8 |
| Detailed | 90–180 | 0.06% of canvas | 12 |
| Very detailed | 180–320 | 0.03% of canvas | 16 |

The numbers are initial targets to tune on real iPhones, not API guarantees.

## Why AI alone is not enough

An image model returns pixels. It does not return trusted clickable regions,
stable IDs, correct number labels or concurrency-safe game state. Even a lovely
line drawing can contain a one-pixel gap that makes a flood fill leak through
half the picture.

The app therefore owns a deterministic conversion and validation stage:

```text
uploaded photo
    → AI flat-color Impressionist reference
    → contour mask
    → closed connected regions
    → small-region cleanup
    → palette quantization
    → stable region IDs + number labels
    → blank playable canvas + colored reference
```

If conversion fails, the user sees `This one has leaky lines — try again`.
Never publish a broken canvas and hope nobody taps the leak.

## Proposed rendering model

Use layered `<canvas>` elements rather than asking the model for SVG:

1. **Fill canvas** — paints completed region masks.
2. **Line canvas** — transparent dark contour artwork.
3. **Number canvas** — crisp labels for unfinished regions.
4. **Hit map** — an off-screen lossless bitmap whose RGB value encodes a
   region ID for each pixel.

All visible layers share one transform. Zoom changes their rendered scale;
pan changes their shared offset. Pointer coordinates are transformed back into
source-image coordinates, then the hit map returns the region ID. Coloring
therefore works at 100% or 400% without geometry guesswork.

Recommended gestures and controls:

- Pinch to zoom on touch devices.
- `−`, zoom percentage and `+` controls as an accessible fallback.
- One-finger pan only after the canvas is zoomed; a short unmoved pointer is a
  fill tap.
- `Fit` returns to the full composition.
- Palette remains outside the transformed canvas and stays reachable.
- Keyboard users can select a palette number and step through unfinished
  regions in document order.

## Deterministic conversion pipeline

The repository has no build step and should not acquire a native image stack.
The first implementation should use browser Canvas APIs and typed arrays in
`js/coloring.js`:

1. Resize the AI result to a bounded analysis resolution (start at 768px on the
   long edge; retain the higher-resolution image for the gallery preview).
2. Convert near-dark pixels into a binary contour mask.
3. Close one- to three-pixel gaps with a small morphological dilation/closing
   pass.
4. Flood-fill every non-contour connected component.
5. Merge components below the selected minimum area into the adjacent region
   with the nearest source color. Decorative islands may instead remain line
   work.
6. Quantize interior pixels to the requested palette using deterministic
   k-means initialization or a fixed median-cut implementation.
7. Give each component a stable integer ID and palette number.
8. Find the label point with a distance transform: use the interior pixel
   farthest from the boundary rather than the bounding-box center, which can
   land outside a crescent or ring.
9. Encode region IDs into an RGB PNG hit map and serialize the palette, label
   points and region metadata into a small manifest.
10. Render a blank preview and run validation before enabling `Use this`.

This processing should yield between animation frames so a phone never appears
frozen. If profiling shows that Detailed mode is too slow on either phone,
reduce the analysis resolution before introducing a dependency or build step.

## Validation gate

Reject or request regeneration when any of these are true:

- Region count falls outside the chosen mode's range.
- More than 15% of regions are below the minimum tappable area before cleanup.
- A non-background region consumes more than 45% of the canvas, a common sign
  that an outline leaked.
- A region has no valid interior label point.
- The palette collapses to fewer than half the requested colors.
- The hit map contains IDs missing from the manifest or vice versa.
- Re-rendering all masks leaves unexplained holes or paints the same pixel from
  multiple region IDs.

The last check is the non-overlap invariant. It must be tested in code, not
judged by looking at the preview.

## AI endpoint

Proposed endpoint: `api/coloring-create.js` (claim the final name in
`SESSIONS.md` when implementation begins).

Responsibilities:

- Accept one resized image plus style, complexity and palette settings.
- Require a valid Lucia/Riu Supabase bearer token before spending API money.
- Enforce file type and size limits and accept one generation at a time per
  user.
- Build the controlled prompt server-side so browser text cannot override the
  structural requirements.
- Call the image-edit endpoint with the provider key stored only in Vercel.
- Return the generated image bytes and minimal generation metadata.
- Return honest `401`, `413`, `429` and upstream failure states the UI can
  explain.

OpenAI's Image API currently supports editing an existing image with a prompt,
and `gpt-image-2` accepts image input and produces image output. The precise
model and request fields must be rechecked against current official docs when
implementation starts; keep the model name in the serverless function rather
than app UI.

Reference at time of this proposal:
[OpenAI image generation and editing guide](https://developers.openai.com/api/docs/guides/image-generation)
and [GPT Image 2 model page](https://developers.openai.com/api/docs/models/gpt-image-2).

The app must never call the image provider directly. Besides exposing the key,
that would let a modified client bypass authentication, prompt controls and
rate limits.

## Upload privacy

The confirmation before generation should say plainly:

> This photo will be sent to our image-generation provider to make the
> coloring page. Only Lucia and Riu can open the saved result in this app.

Additional rules:

- Resize in the browser before upload and strip incidental metadata.
- Do not place the original or generated images in a URL hash.
- Store files only under signed/private Supabase Storage paths.
- Reuse the existing private `food` bucket under
  `coloring/<artwork-id>/...` unless a future storage review chooses a
  dedicated bucket. This avoids accidentally creating another public bucket.
- Delete the transient server upload after the provider request completes.
- Default to deleting the original after a valid coloring artifact is built.
  Offer `Keep the original beside the artwork` as an explicit choice.
- Never use uploaded photos for a public starter library without separate,
  explicit permission.

## Shared data model

This feature is larger than a `settings` row. Proposed migration:
`supabase/coloring.sql`.

### `coloring_artworks`

One row per generated or built-in work:

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `title` | User-entered gallery title |
| `created_by` | `lucia` or `riu` |
| `status` | `draft`, `active`, `complete`, `archived` |
| `style` | Generation style identifier |
| `complexity` | `relaxed`, `detailed`, `very_detailed` |
| `palette` | Ordered JSON palette; index + 1 is the printed number |
| `region_count` | Validation and progress denominator |
| `width`, `height` | Source coordinate system |
| `reference_path` | Private colored AI output |
| `outline_path` | Private transparent contour PNG |
| `region_map_path` | Private lossless RGB region-ID PNG |
| `manifest_path` | Private region metadata JSON |
| `preview_path` | Finished or current gallery thumbnail |
| `original_path` | Nullable; only when explicitly retained |
| `created_at`, `completed_at` | Gallery ordering and completion state |

### `coloring_fills`

One row per completed region:

| Column | Purpose |
|---|---|
| `artwork_id` | Parent artwork |
| `region_id` | Stable ID from the manifest |
| `filled_by` | `lucia` or `riu` |
| `filled_at` | Attribution and ordering |

Primary key: `(artwork_id, region_id)`.

The required color is not writable shared state; it comes from the immutable
manifest. Filling is an insert with `on_conflict=do_nothing`, so simultaneous
taps on the same final region cannot disagree. Undo deletes that fill row and
requires a deliberate action once the artwork is complete.

RLS must use `public.is_us()` for both tables. Storage paths inherit the
private bucket's existing Lucia/Riu policies.

## Synchronization and idle cost

- Keep the active artwork in memory while its Games sub-view is visible.
- Poll fills only when `activeTab === "duel"` and the Color Together chooser
  is selected.
- Use the existing stale-pull write-counter pattern: a response that started
  before a local fill must not temporarily erase that fill.
- Pull immediately on focus/visibility return, then use a modest active poll.
- Back off while `document.hidden`; never poll from a hidden game sub-view.
- Update only the affected region when a new fill arrives, not every canvas
  pixel.
- Re-render and upload the gallery thumbnail at checkpoints rather than after
  every tap (for example every 10 fills and on completion).

## Offline behavior

Custom-photo generation is honestly unavailable without the network, the AI
endpoint or valid authentication. That does not make the whole game a boot
dependency.

The initial release should ship at least one built-in starter artwork and its
manifest in `js/coloring.js` (or a checked-in asset folder). It remains fully
colorable in one-phone memory mode when Supabase and the API are unavailable.
The UI distinguishes:

- `Shared live 💞`
- `Coloring locally — fills are not saved`
- `Connect to make a page from your photo`

Do not queue private photos or fills in `localStorage`, IndexedDB or a service
worker; those are outside this app's persistence rules.

## Gallery behavior

`Our Art Gallery` shows active and completed work, newest first. A card contains
the rendered thumbnail, title, completion percentage, created date and visible
Lucia/Riu contribution counts.

- Tapping an active work resumes it.
- Tapping a completed work opens a zoomable read-only view.
- `Edit finished artwork` requires confirmation and changes it back to active.
- Deleting confirms that the artwork, all fills and every stored artifact will
  be removed.
- Completing the final region sets `status = complete`, stamps
  `completed_at`, creates a fresh preview and celebrates once on each phone.
- The source photo is not displayed unless `Keep the original` was selected.

## Proposed files and identifiers

These are recommendations, not registry claims. Recheck and claim them in
`SESSIONS.md` immediately before implementation:

- `js/coloring.js`
- `css/coloring.css`
- `api/coloring-create.js`
- `supabase/coloring.sql`
- element/function prefix `cl*`
- Games chooser value `coloring`
- tables `coloring_artworks`, `coloring_fills`
- storage prefix `coloring/`

No deterministic seed offset is needed: the artwork is explicitly created and
shared through Supabase rather than independently derived by two phones.

## Delivery plan

Keep implementation PRs small and land the risk in this order.

### Phase 1 — prove the canvas

- One checked-in organic Impressionist starter picture.
- Numbered palette, correct-number validation, fill/undo.
- Region hit map, crisp number overlay, pinch/controls zoom and pan.
- Memory-only progress.
- Phone-width and desktop verification.

Exit criterion: every region remains selectable between 100% and 400% zoom,
no two region IDs paint the same source pixel, and the picture can be completed
without a drawing gesture.

### Phase 2 — shared active artwork

- `coloring_artworks` and `coloring_fills` migration + RLS.
- Private artifact storage.
- Two-phone fill synchronization and honest local fallback.
- One active canvas and basic gallery.

Exit criterion: Lucia and Riu can fill different regions concurrently without
lost updates, including the same-region race.

### Phase 3 — photo-to-page generation

- Upload/crop/resize flow and privacy confirmation.
- Authenticated, rate-limited `api/coloring-create.js`.
- AI generation plus deterministic Canvas conversion.
- Validation gate and review/regenerate controls.

Exit criterion: a representative test set of portraits, food, travel, pets and
landscapes produces a valid playable page often enough that regeneration feels
exceptional rather than normal.

### Phase 4 — gallery polish

- Finished previews, attribution counts, titles and completion dates.
- Archive/delete/edit-finished flows.
- More built-in themes and generation presets.
- Performance and storage cleanup after real use.

## Test matrix

At minimum, exercise:

- 375–420px phone width and desktop width.
- Touch tap versus pan threshold at 100%, 200% and 400% zoom.
- Pinch zoom while a numbered color is selected.
- Concave, ring-shaped and narrow regions; label points must stay inside.
- Two phones filling different regions and the same region simultaneously.
- Poll response arriving after a local fill.
- Supabase offline, AI endpoint offline and invalid auth.
- Large upload, unsupported file, provider rate limit and generation failure.
- A generated image with an open contour, too many tiny regions and too few
  palette colors.
- Theme contrast in every app theme; artwork colors remain intrinsic while
  controls and labels use shared theme variables.
- Double-click `index.html`: starter artwork works and no module/import breaks
  `file://`.
- All existing tabs, choosers, the lock and hidden Moon entrance remain intact.

## Questions to resolve with the first implementation PR

1. Should the first active canvas be unique, or may several artworks be active
   at once? Recommendation: one active canvas, unlimited gallery drafts later.
2. Should a correct region fill immediately, or require tapping a selected
   region twice? Recommendation: immediate fill; undo remains visible.
3. Who may regenerate or delete a shared draft? Recommendation: either person,
   with confirmation once the other person has contributed.
4. Should originals be retained? Recommendation: delete by default and make
   retention opt-in per artwork.
5. What conversion success rate is acceptable? Recommendation: at least 80% of
   the representative test set passes automatically before enabling uploads in
   the live app.
