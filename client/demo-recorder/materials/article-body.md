## Designing a Modern Content Platform

The ELISEI product direction focuses on a **unified content model** that keeps publication workflows consistent across posts, articles, videos, and moments. It also keeps room for future product growth without forcing each new surface to invent its own rules.

### Why the architecture matters

When the same platform needs to support feed discovery, profile pages, reactions, comments, and storage-backed media, the best outcome comes from a shared domain core instead of disconnected feature islands.

> A stable product experience depends on stable backend contracts.

### Core principles

- Keep routers thin and explicit.
- Move orchestration into service layers.
- Prefer backend-controlled media access.
- Reuse shared content semantics wherever possible.

### Delivery checklist

1. Define the content lifecycle clearly.
2. Keep permissions explicit.
3. Design storage around real read and write paths.

### Example integration

Inline code such as `content_id` and `canonical_path` should stay understandable at both API and UI layers.

```js
const publication = {
  type: "article",
  visibility: "public",
  status: "published",
};

console.log("Publishing", publication.type);
```

### Capability map

| Surface | Shared concern | Result |
| --- | --- | --- |
| Feed | Discovery | Consistent ranking and reactions |
| Articles | Rich rendering | Structured knowledge sharing |
| Videos | Media delivery | Playback, covers, and history |
| Messenger | Collaboration | Replies, files, and reactions |

### Visual proof points

{{ARTICLE_IMAGE_1}}

The first image highlights how the product presents structured knowledge, while the second image helps demonstrate attachment rendering and polished media output.

{{ARTICLE_IMAGE_2}}

### Embedded platform video

The following block uses a video that already exists on this platform, not a third-party embed:

{{PLATFORM_VIDEO_DIRECTIVE}}

### Final note

Additional references can be linked directly, for example [the project homepage](https://example.com), while the platform keeps its own assets and publication state under application control.
