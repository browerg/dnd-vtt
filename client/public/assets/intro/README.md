# Entrance media

The current intro (v2) is drawn in code by `src/components/Entrance.tsx` and
`Entrance.css`; it uses only these two files:

- `vivid-realms-logo.webp`: the Vivid Realms crest, 512 × 512 with transparency.
- `entrance-v2.m4a`: the original intro soundtrack (8.4 s), copied out of
  `entrance-v1.mp4` without re-encoding:

```
ffmpeg -i entrance-v1.mp4 -vn -c:a copy -movflags +faststart entrance-v2.m4a
```

The animation's keyframe delays are timed to this soundtrack (peak at 1.6 s,
second hit at 4.8 s, fade from 6.6 s). If the soundtrack changes, retime them.

`entrance-v1.mp4` and `entrance-v1.webp` are the previous video intro and its
poster. Nothing loads them any more.

The sparkle button is adapted from the user-supplied Uiverse.io snippet by
MuhammadHasann. Its attribution remains in the component and stylesheet.
