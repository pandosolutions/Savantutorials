# Savant Tutorial Studio

Standalone, staging-only tutorial generation for Savant Talent. This repository contains the browser agent, capture, editing and review pipeline. It has no dependency on the production website repository or PR #53.

The implemented flow is **Claude plans → screenshot-guided browser agent → Playwright capture → Claude visual review → FFmpeg edit and media validation → captioned MP4**. Claude chooses from a bounded catalog of scene actions; it cannot execute generated JavaScript or arbitrary clicks. Supported actions are observe, focus, scroll and navigation through a declared visible same-origin anchor. Authentication happens before recording in a separate browser context.

## Setup

Requires Node 22+, Chromium, FFmpeg and FFprobe on PATH (or explicit executable paths).

```sh
npm ci
npx playwright install chromium
# Install FFmpeg and FFprobe with your platform package manager.
cp .env.example .env
npm run check
npm test
npm run test:smoke
npm run record -- job-feed
```

Configure `.env` locally:

- `STAGING_BASE_URL` and `STAGING_ALLOWED_ORIGIN`: the same isolated HTTPS origin. Known production Savant hosts are rejected.
- `TALENT_EMAIL`, `TALENT_PASSWORD`: a synthetic staging identity, never a real applicant account.
- `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`: your API key and an available vision-capable model identifier. A run makes one planning call, up to twelve action-selection calls, and one review call; requests have timeouts and token limits. API errors stop the run rather than silently changing models.
- `AUTHENTICATED_SELECTOR`: a unique marker that is visible only after successful login.
- `LOGIN_POST_PATHS`: JSON array of exact, same-origin authentication POST endpoints. No other write requests are permitted. External identity providers and third-party APIs are intentionally unsupported in this initial adapter.
- Optional `LOGIN_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`, `OUTPUT_DIR`.

The three scene manifests are **unverified starting assumptions** from the original starter: `job-feed`, `applications`, and `coach`. Verify their route, exact heading, selectors and narration against your staging build before use. A missing heading or target stops the run. Employer, industry, autofill and other personas are not yet implemented.

## Run behavior and artifacts

Every run has a unique directory under `output/`. It contains a plan, screenshots, action evidence with timestamps, AI review, raw WebM and `run.json`. Successful runs also contain an H.264 1440×900 MP4 and SRT captions. Captions are embedded as a default-selectable MP4 subtitle track; enable captions in your player. There is no synthesized voiceover in this version.

FFmpeg cuts the recording to action segments and removes the time spent waiting on model decisions and review. FFprobe verifies codec, dimensions, positive duration and file size. Login footage is never recorded; authentication state stays in memory. Each capture uses its own Playwright Video object, so old footage cannot be accidentally selected.

Capture permits only same-origin GET/HEAD/OPTIONS traffic, blocks WebSockets and service workers, dismisses dialogs and disables downloads. Authentication permits only declared POST endpoints in addition to reads. These controls constrain the available workflow; an application requiring GraphQL POST queries or external assets needs a reviewed adapter before it can be recorded. Scene files are trusted code configuration: review navigation links and routes, including any endpoint that might mutate on GET.

A failed visual review or blocked network operation exits nonzero and prevents final MP4 export. Failure artifacts remain local for diagnosis. `privacyReviewRequired` remains true even on success: AI visual review does not establish that footage is free of private data. Use synthetic data and inspect the final recording before sharing it. Screenshots are transmitted to Anthropic for planning and review. Nothing is automatically published or uploaded. Remove local run artifacts when no longer needed.

## Optional MCP video editor

A real stdio MCP client is included. Set `MCP_VIDEO_CONFIG` to a local JSON file containing the exact tool configuration for your chosen server:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/your-installed-video-server.js"],
  "tool": "REPLACE_WITH_SERVER_TOOL_NAME",
  "arguments": {
    "input": "{{input}}",
    "output": "{{output}}"
  }
}
```

Install and pin the intended server separately. Adapt the argument structure to its actual tool schema; nested input/output placeholders are expanded recursively. The client discovers tools and rejects an unavailable tool or an MCP error. Only PATH and Windows SystemRoot are inherited by the editor process, keeping staging credentials and the Claude key out of its environment. The adapter does not sandbox a local server: use a trusted installed executable.

The editor receives the FFmpeg candidate and must write `mcp-edited.mp4`. FFprobe validates that file. It is a separate draft requiring fresh visual review; the main exported MP4 remains the reviewed FFmpeg cut. This adapter is tested against a fixture MCP server. Compatibility with a particular product named `mcp-video` awaits its exact repository, tool schema and installation instructions.

## Gauntlet and computer use

The working browser agent uses Claude vision and explicit Playwright actions. It is not Anthropic's unrestricted desktop computer-use toolset. The exact **Gauntlet** project/API has not been identified, so no fictional Gauntlet SDK is imported. Provide its repository and version to implement and validate a dedicated explorer adapter. Future explorers must produce scene manifests consumed by the same validated runner rather than bypass the capture policy.

## Verification

`npm run check` checks TypeScript. `npm test` verifies staging policy, plan validation, caption timing, Claude response handling and a real MCP stdio client/server exchange. `npm run test:smoke` uses real Chromium and FFmpeg against synthetic fixtures with mocked Claude replies. It verifies network blocking, action execution, QA rejection, video recording, editing, captions and FFprobe validation. It makes no live Claude calls or staging requests. CI runs all three commands on Linux.

A live Savant acceptance run still requires staging access, validated selectors, a Claude key/model and the identified optional integrations. No production migration or website deployment is part of this project.

Implementation references: [Claude Messages API](https://platform.claude.com/docs/en/api/messages), [Playwright video lifecycle](https://playwright.dev/docs/videos), [MCP TypeScript SDK v1](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x).

### Connected staging adapter

Set STAGING_API_ORIGIN to the exact isolated Supabase origin. Both original Savant project references are rejected. The adapter permits reads plus password/session token exchange, the last-active heartbeat and the read-only employer ratings RPC. Optional notification WebSockets stay disconnected. Fonts and Google sign-in assets may load, but external navigation stays blocked. The local .env takes precedence over inherited desktop settings. The verified job-feed heading is Your job feed; the staging login route is /auth. Other scene assumptions still require validation. test/staging-preflight.ts runs the actual staging recording flow with mocked model replies and writes only to test-output; it is not a live AI review.

