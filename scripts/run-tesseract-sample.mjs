import { createWorker } from 'tesseract.js';

const imagePath = process.argv[2];
if (!imagePath) throw new Error('Usage: node scripts/run-tesseract-sample.mjs <image>');
const worker = await createWorker('eng+chi_tra', 1, {
  logger: (message) => {
    if (message.status === 'recognizing text' && typeof message.progress === 'number') {
      console.error(`recognizing ${(message.progress * 100).toFixed(0)}%`);
    }
  },
});
try {
  const result = await worker.recognize(imagePath);
  console.log(result.data.text);
} finally {
  await worker.terminate();
}
