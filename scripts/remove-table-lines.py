from pathlib import Path
import cv2

source = '/home/ubuntu/upload/pasted_file_oWopZi_image.png'
out = Path('/tmp/claim-form-lines-removed')
out.mkdir(parents=True, exist_ok=True)
image = cv2.imread(source, cv2.IMREAD_GRAYSCALE)
scale = 4
image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
normalized = cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX)
threshold = cv2.adaptiveThreshold(normalized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 12)
horizontal = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (120, 1)))
vertical = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 120)))
lines = cv2.bitwise_or(horizontal, vertical)
text_mask = cv2.bitwise_and(threshold, cv2.bitwise_not(lines))
result = cv2.bitwise_not(text_mask)
result = cv2.medianBlur(result, 3)
cv2.imwrite(str(out / 'all-lines-removed.png'), result)
# A less aggressive version removes only long horizontal/vertical lines.
soft = cv2.bitwise_not(cv2.bitwise_and(threshold, cv2.bitwise_not(cv2.bitwise_or(
    cv2.morphologyEx(threshold, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (250, 1))),
    cv2.morphologyEx(threshold, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 250)))
))))
cv2.imwrite(str(out / 'long-lines-removed.png'), soft)
print(out)
