from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

source = Path('/home/ubuntu/upload/pasted_file_oWopZi_image.png')
out = Path('/tmp/claim-form-preprocessed')
out.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('RGB')
scaled = image.resize((image.width * 3, image.height * 3), Image.Resampling.LANCZOS)
gray = ImageOps.grayscale(scaled)
contrast = ImageEnhance.Contrast(gray).enhance(2.2)
contrast.save(out / 'gray-contrast.png')
contrast.filter(ImageFilter.SHARPEN).save(out / 'gray-sharp.png')
threshold = contrast.point(lambda p: 0 if p < 185 else 255)
threshold.save(out / 'binary-185.png')
threshold2 = contrast.point(lambda p: 0 if p < 210 else 255)
threshold2.save(out / 'binary-210.png')
print(out)
for p in sorted(out.glob('*.png')):
    im = Image.open(p)
    print(p.name, im.size)
