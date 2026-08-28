from pathlib import Path
from PIL import Image
import numpy as np

source = Path('/home/ubuntu/upload/螢幕擷取畫面2026-08-21174437.png')
out = Path('/tmp/browser-claim-preprocess')
out.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('RGB')
scale = 3
image = image.resize((image.width * scale, image.height * scale), Image.Resampling.LANCZOS)
array = np.asarray(image).copy()
luminance = 0.299 * array[:, :, 0] + 0.587 * array[:, :, 1] + 0.114 * array[:, :, 2]
gray = np.clip(np.rint((luminance - 128) * 1.8 + 128), 0, 255).astype(np.uint8)
cleaned = gray.copy()
height, width = gray.shape
for y in range(height):
    dark = gray[y] < 165
    start = None
    for x in range(width + 1):
        active = x < width and bool(dark[x])
        if active and start is None:
            start = x
        if (not active or x == width) and start is not None:
            if x - start >= max(80, width * 0.08):
                cleaned[y, start:x] = 255
            start = None
for x in range(width):
    dark = gray[:, x] < 165
    start = None
    for y in range(height + 1):
        active = y < height and bool(dark[y])
        if active and start is None:
            start = y
        if (not active or y == height) and start is not None:
            if y - start >= max(80, height * 0.12):
                cleaned[start:y, x] = 255
            start = None
out.joinpath('browser-equivalent.png').write_bytes(Image.fromarray(cleaned, mode='L').point(lambda p: 0 if p < 190 else 255).convert('L').tobytes())
# Use save() explicitly after the byte-level output above.
Image.fromarray(cleaned, mode='L').point(lambda p: 0 if p < 190 else 255).save(out / 'browser-equivalent.png')
Image.fromarray(gray, mode='L').save(out / 'browser-gray.png')
Image.fromarray(gray, mode='L').point(lambda p: 0 if p < 190 else 255).save(out / 'browser-binary.png')
print(out)
for path in sorted(out.glob('*.png')):
    with Image.open(path) as img:
        print(path.name, img.size)
