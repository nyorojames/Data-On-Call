import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Running Cypress demo spec headless...');
try {
  execSync('npx cypress run --spec cypress/e2e/demo.cy.js', { stdio: 'inherit' });
} catch (err) {
  console.error('Cypress run completed with code:', err.status);
}

const rawVideoPath = path.resolve('cypress/videos/demo.cy.js.mp4');
const targetVideoPath = path.resolve('cypress/videos/demo.mp4');

if (fs.existsSync(rawVideoPath)) {
  try {
    const durationOutput = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${rawVideoPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    const duration = parseFloat(durationOutput);
    console.log(`Raw video duration: ${duration.toFixed(2)}s`);

    const ptsFactor = (60.0 / duration).toFixed(6);
    console.log(`Adjusting speed with factor (60.0 / ${duration.toFixed(2)}) = ${ptsFactor}...`);
    execSync(
      `ffmpeg -y -i "${rawVideoPath}" -filter:v "setpts=(${ptsFactor})*PTS" -an "${targetVideoPath}"`,
      { stdio: 'inherit' }
    );

    const finalDuration = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetVideoPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    console.log(`Successfully generated demo video: ${targetVideoPath}`);
    console.log(`Final duration: ${parseFloat(finalDuration).toFixed(2)}s`);
  } catch (ffmpegErr) {
    console.warn('ffmpeg post-processing skipped or failed:', ffmpegErr.message);
    // If ffmpeg fails, ensure demo.mp4 is available by copying
    if (!fs.existsSync(targetVideoPath)) {
      fs.copyFileSync(rawVideoPath, targetVideoPath);
    }
  }
} else {
  console.warn('No video output found at', rawVideoPath);
}
