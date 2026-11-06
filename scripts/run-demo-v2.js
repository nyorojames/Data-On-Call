import { spawn, spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

function waitForServer(url, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Server start timed out after ' + timeout + 'ms'));
        } else {
          setTimeout(check, 300);
        }
      });
      req.end();
    };
    check();
  });
}

async function main() {
  console.log('=== Step 1: Starting local server for v2 demo video recording ===');
  const server = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  try {
    await waitForServer('http://127.0.0.1:3000');
    console.log('\n=== Step 2: Running Cypress demo-v2 spec headless ===');

    spawnSync('npx.cmd', ['cypress', 'run', '--spec', 'cypress/e2e/demo-v2.cy.js'], {
      stdio: 'inherit',
      shell: true,
    });

    const rawVideoPath = path.resolve('cypress/videos/demo-v2.cy.js.mp4');
    const targetVideoPath = path.resolve('cypress/videos/demo-v2.mp4');

    if (fs.existsSync(rawVideoPath)) {
      try {
        const durationOutput = spawnSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', rawVideoPath],
          { encoding: 'utf-8' }
        ).stdout.trim();

        const duration = parseFloat(durationOutput);
        console.log(`\nRaw video recorded duration: ${duration.toFixed(2)}s`);

        // Target 70 seconds (cleanly within 60 to 90 seconds range)
        const targetDuration = 70.0;
        const ptsFactor = (targetDuration / duration).toFixed(6);
        console.log(`Adjusting speed with factor (${targetDuration} / ${duration.toFixed(2)}) = ${ptsFactor}...`);

        spawnSync(
          'ffmpeg',
          ['-y', '-i', rawVideoPath, '-filter:v', `setpts=(${ptsFactor})*PTS`, '-an', targetVideoPath],
          { stdio: 'inherit' }
        );

        const finalDuration = spawnSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', targetVideoPath],
          { encoding: 'utf-8' }
        ).stdout.trim();

        console.log(`\nSuccessfully generated demo video: ${targetVideoPath}`);
        console.log(`Exact final duration: ${parseFloat(finalDuration).toFixed(2)}s`);
      } catch (ffmpegErr) {
        console.warn('ffmpeg post-processing skipped or failed:', ffmpegErr.message);
        if (!fs.existsSync(targetVideoPath)) {
          fs.copyFileSync(rawVideoPath, targetVideoPath);
        }
      }
    } else {
      console.warn('No raw video output found at', rawVideoPath);
    }
  } finally {
    console.log('Stopping local server...');
    if (server.pid) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore' });
    }
  }
}

main();
