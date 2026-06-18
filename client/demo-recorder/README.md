# Demo Recorder

Place the prepared media files in these folders before recording:

- `client/demo-recorder/materials/post/`
- `client/demo-recorder/materials/article/`
- `client/demo-recorder/materials/video/`
- `client/demo-recorder/materials/messenger/`

Expected filenames:

- `materials/post/image-1.png`
- `materials/post/image-2.png`
- `materials/post/attachment.pdf`
- `materials/article/image-1.png`
- `materials/article/image-2.png`
- `materials/video/long-video.mp4`
- `materials/video/cover.png`
- `materials/messenger/image-1.png`
- `materials/messenger/image-2.png`
- `materials/messenger/attachment.pdf`

Create `client/demo-recorder/.env.demo-recorder` from `.env.demo-recorder.example`, then set:

- `DEMO_BASE_URL`
- `DEMO_USER_LOGIN`
- `DEMO_USER_PASSWORD`
- `DEMO_CHAT_NAME`

Recorder defaults:

- dark theme is forced for all scenes
- viewport and final build output are normalized to `1920x1080`
- raw scene capture uses a separate high-quality ffmpeg-backed encode path during `npm run demo:record`; this replaces Playwright's built-in low-bitrate `.webm` recording because it compressed the UI too aggressively
- `DEMO_ACTION_DELAY_MS` controls the small human-like pacing between automated actions

If your existing raw videos were recorded before the high-quality recorder update, rebuild alone will not improve them. Re-run `npm run demo:record` first so `out/raw/` is regenerated, then run `npm run demo:build-video`.

The default demo materials assume your environment already has searchable English demo content. If the feed-search scene returns "Nothing found", update `materials/demo-content.yml` with a query that matches content already present in your local dataset.

Install frontend dependencies before running the recorder:

```bash
cd client
npm ci
```

If `npm ci` fails with `EACCES` and `client/node_modules` is owned by another user, fix ownership first:

```bash
sudo chown -R "$USER":"$USER" client/node_modules
cd client
npm ci
```

Install the Playwright browser binaries after dependencies are ready:

```bash
cd client
npm run demo:install-browsers
```

Start the application before running recorder auth or scenes. The recorder does not boot the app for you; it expects `DEMO_BASE_URL` to already be reachable.

Typical local frontend start:

```bash
cd client
npm start
```

If your local stack also needs backend services for login/content flows, start them before running the recorder.

If you change `DEMO_BASE_URL` or switch between `localhost` and `localhost:5173`, rerun `npm run demo:auth`. The saved auth state is origin-specific.
`npm run demo:record` also re-runs auth automatically when the saved access token is missing, expired, or too close to expiry for a full recording pass.

Run the recorder:

```bash
npm run demo:install-browsers
npm run demo:auth
npm run demo:record
npm run demo:record -- --grep "post"
npm run demo:build-video
```

`ffmpeg` must be installed and available in `PATH` for both `npm run demo:record` and `npm run demo:build-video`.

Outputs:

- Raw scene videos: `client/demo-recorder/out/raw/`
- Normalized scene mp4 files: `client/demo-recorder/out/scenes/`
- Final combined video: `client/demo-recorder/out/final/diploma-demo-final.mp4`

Manual demo mode can be enabled in the browser with `?demo=1` or `localStorage.demoMode = "true"`.

If long-video processing is slow, keep the application running and rerun the recorder after the environment is warm. The `04-long-video` scene waits for the created video page to become ready and fails if that never happens within the configured timeout.

The build script automatically picks a compatible MP4 encoder from your local ffmpeg build and does not require `libx264` specifically.
