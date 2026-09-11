# Entrance media

`entrance-v1.webp` is the exact first frame of the user-supplied
`website intro.mp4`, encoded as WebP at quality 85 (1920 × 1080, 57,808 bytes).

`entrance-v1.mp4` retains the supplied soundtrack and was encoded with:

```
ffmpeg -i "website intro.mp4" -vf scale=1280:-2 -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart entrance-v1.mp4
```

The result is 999,713 bytes. Keep poster and video identically framed; the
entrance uses `object-fit: contain` to preserve the full scene on all screens.
Version both filenames when changing the media to invalidate browser caches.

The sparkle button is adapted from the user-supplied Uiverse.io snippet by
MuhammadHasann. Its attribution remains in the component and stylesheet.
