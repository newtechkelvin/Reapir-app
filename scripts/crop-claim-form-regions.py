from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

source = Path('/home/ubuntu/upload/pasted_file_oWopZi_image.png')
out = Path('/tmp/claim-form-regions')
out.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('L')
regions = {
    'top-left': (0, 0, 654, 270),
    'top-right': (654, 0, 1308, 270),
    'bottom-left': (0, 270, 654, 404),
    'bottom-right': (654, 270, 1308, 404),
}
for name, box in regions.items():
    crop = image.crop(box)
    crop = crop.resize((crop.width * 4, crop.height * 4), Image.Resampling.LANCZOS)
    crop = ImageEnhance.Contrast(crop).enhance(2.0).filter(ImageFilter.SHARPEN)
    crop.save(out / f'{name}.png')
    crop.point(lambda p: 0 if p < 190 else 255).save(out / f'{name}-binary.png')
print(out)
