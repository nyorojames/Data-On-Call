import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../node_modules/onnxruntime-web/dist');
const destDir = path.resolve(__dirname, '../public/ort');

if (!fs.existsSync(srcDir)) {
  console.warn(`[copy-ort] Source directory does not exist: ${srcDir}`);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir);
let copiedCount = 0;

for (const file of files) {
  if (file.endsWith('.wasm') || file.endsWith('.mjs')) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.copyFileSync(srcFile, destFile);
    copiedCount++;
  }
}

console.log(`[copy-ort] Copied ${copiedCount} files from onnxruntime-web/dist to public/ort/`);
