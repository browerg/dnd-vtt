"""Build UI-sized WebP badges from the archival PNGs (requires Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "artwork" / "achievement-badges"
destination = root / "client" / "public" / "assets" / "achievements"
destination.mkdir(parents=True, exist_ok=True)

for path in sorted(source.glob("*.png")):
    with Image.open(path) as original:
        for size in (72, 144, 384):
            output = destination / f"{path.stem}-{size}.webp"
            mode = "RGBA" if "A" in original.getbands() or "transparency" in original.info else "RGB"
            original.convert(mode).resize((size, size), Image.Resampling.LANCZOS).save(
                output, "WEBP", quality=82, method=6
            )
            print(f"{output.name}: {output.stat().st_size:,} bytes")
