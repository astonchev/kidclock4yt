# Kid Clock for YouTube: Firefox extension spec

## Purpose
Limit kids' YouTube watching to scheduled time slots. Outside the allowed slots, the video player is replaced by an analog clock that highlights the allowed slots, so the kid can see when watching is allowed again.

## Requirements
- Runs only on `m.youtube.com`.
- Keeps a schedule of allowed time slots, edited on a settings page.
- Outside allowed slots, the player is replaced by a clock face:
  - Gray face, white digits, white hour boundaries, black hands.
  - Allowed slots highlighted: yellow for a.m., blue for p.m.
- Supports Firefox desktop and Firefox for Android.

## Decisions
- The same schedule applies every day (one list of slots).
- The settings page has no PIN or password.
- When a slot ends, the player is blocked immediately, even mid-video.

## Naming
- Display name: **Kid Clock for YouTube**.
- Extension ID: `kidclock4yt@astonchev.github.io`. This can't change after the first signed release.
- Slug and prefix: `kidclock4yt`.
  - JS namespace: `globalThis.kidclock4yt.{schedule, clock}`.
  - CSS classes: `kidclock4yt-*`.
  - DOM attribute: `data-kidclock4yt-blocked`.
- Author: `astonchev`.

## Architecture
Manifest V3 WebExtension. No build step, no dependencies: plain JS, CSS and inline SVG.

```
manifest.json
src/schedule.js        # pure schedule logic
src/clock.js           # clock face (shared by content script + options preview)
src/content.js         # blocking/overlay logic on m.youtube.com
src/content.css        # overlay styling
options/options.html   # settings page
options/options.js
options/options.css
icons/icon.svg
test/schedule.test.js  # node --test
```

### Manifest
- `permissions: ["storage"]`.
- Content scripts match `*://m.youtube.com/*`, run at `document_start`.
- `options_ui` opens in a tab. On Android it's under Add-ons → extension → Settings.
- `strict_min_version`:
  - Desktop: 140.0.
  - Android: 142.0.
  - These are the first versions that support `data_collection_permissions`.
- `data_collection_permissions.required = ["none"]`.

### Schedule model (`src/schedule.js`)
- Stored in `browser.storage.local` as `{ slots: [{ start: "HH:MM", end: "HH:MM" }] }`.
- An empty list means always blocked.
- Start is inclusive and end is exclusive.
- If `end < start`, the slot wraps past midnight (e.g. 22:00–01:00).
- `start == end` is invalid.
- API, exposed on `globalThis.kidclock4yt.schedule` and via `module.exports`:
  - `toMin`, `fmt`.
  - `isValidSlot`, `normalize`.
  - `isAllowed(date, slots)`.
  - `slotsToArcs(slots)`: splits slots at noon and midnight into `{ half: "am"|"pm", fromMin, toMin }`.
  - `nextSlot(date, slots)`.

### Clock face (`src/clock.js`)
- SVG with viewBox 200×200.
- Gray face `#808080`, white hour tick lines, white numerals 1–12.
- Allowed slots are drawn as arc bands at the rim:
  - A.M.: outer band, yellow `#FFD400`.
  - P.M.: inner band, blue `#2F7BFF`.
  - Separate bands keep an a.m. slot and a p.m. slot at the same clock position from overlapping.
- Black hour, minute and second hands, plus a center cap.
- Caption below the clock shows one of:
  - "Next: HH:MM–HH:MM".
  - "Watching allowed now".
  - "No time slots configured".
- `buildClock(slots)` returns `{ el, svg, setSlots, tick }`.

### Content script (`src/content.js`)
- Treated as blocked until storage has loaded.
- Edits to the schedule apply live via `storage.onChanged`.
- Checks once per second. While blocked:
  - Exits fullscreen.
  - Pauses and mutes every `<video>`. This covers watch pages, Shorts and home-feed previews.
  - Covers each player container with a clock overlay and hides the player's other children.
    - Containers: `#player-container-id`, `.player-container`, `ytm-player`, `#player`, or the parent of a video. Only the outermost match is used.
  - The overlay swallows taps and clicks.
- A capture-phase `play`/`playing` listener re-pauses any video that starts while blocked.
- A `MutationObserver` (throttled to one update per animation frame) re-attaches overlays after the site swaps the player during navigation.
- When allowed again:
  - Overlays are removed.
  - Videos the extension muted are unmuted.
- The watch-page container gets a minimum height of `min(56.25vw, 70vh)` so the clock is always visible.

### Options page (`options/`)
- Each slot row has a start and end `<input type="time">` and a remove button.
- Buttons: "Add slot" and "Save".
- Validation:
  - Both times are required and must differ.
  - Invalid rows are highlighted.
  - Overnight slots are labeled "(overnight)".
- Slots are sorted by start time on save.
- A live clock preview with an a.m./p.m. legend updates as rows are edited.
- Responsive layout with 44px touch targets.

## Verification
1. Run the unit tests: `node --test test/schedule.test.js`. They cover:
   - Slot boundaries and overnight wrap.
   - Empty and invalid slots.
   - Arc splitting at noon and midnight.
   - `nextSlot`.
2. Lint: `npx web-ext lint` should report 0 errors and 0 warnings.
3. Desktop: `npx web-ext run --start-url https://m.youtube.com`.
   - Set a slot covering the current time and confirm a video plays.
   - Change the slot to end within a minute and confirm the video pauses and the clock replaces the player at the boundary.
   - Check the arc colours and hand positions.
   - Navigate between videos and confirm the overlay persists.
   - Confirm `www.youtube.com` is unaffected.
4. Android: `npx web-ext run -t firefox-android --adb-device <id> --firefox-apk org.mozilla.fenix`.
   - Repeat the checks above.
   - Confirm the settings page opens from the Add-ons menu.
5. Distribution:
   - Build with `web-ext build` and sign via AMO (unlisted).
   - Release Firefox for Android requires a signed add-on; Nightly allows side-loading.

## Known limitations
- Overlay placement depends on m.youtube.com's page structure. If the selectors break, videos are still paused, but the clock may not appear in place of the player.
- No protection against changing the schedule or disabling the extension.
