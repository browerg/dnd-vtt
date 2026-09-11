# Badge source artwork

These PNGs are archival source images, not runtime assets. Keep them outside
`client/public` so they are not copied into the web build.

Run `python scripts/optimize_badges.py` from the repository root with Pillow
installed to regenerate the WebPs in `client/public/assets/achievements`:

- 72px: standard-density unlock notifications.
- 144px: double-density unlock notifications.
- 384px: profile gallery and showcase artwork (up to 166 CSS pixels).

The achievement tests enforce download budgets of 4 KiB, 10 KiB, and 40 KiB,
respectively. Review the generated artwork visually when replacing a source.
