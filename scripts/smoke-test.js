import http from 'http';
import { spawn, spawnSync } from 'child_process';

const PORT = 4173;

function waitForServer(url, timeout = 15000) {
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
  console.log('=== Step 1: Building production bundle (mode: production) ===');
  const buildResult = spawnSync('npx.cmd', ['vite', 'build', '--mode', 'production'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_BASE: '/' },
  });
  if (buildResult.status !== 0) {
    console.error('Production build failed!');
    process.exit(1);
  }

  console.log('\n=== Step 2: Spawning plain Node static server (no Express) on port ' + PORT + ' ===');
  const server = spawn('node', ['scripts/static-server.js'], {
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  try {
    await waitForServer(`http://127.0.0.1:${PORT}`);
    console.log('\n=== Step 3: Running Cypress parity smoke test against Hugging Face production model ===');
    const cypressResult = spawnSync(
      'npx.cmd',
      ['cypress', 'run', '--spec', 'cypress/e2e/smoke.cy.js', '--config', `baseUrl=http://127.0.0.1:${PORT}`],
      {
        stdio: 'inherit',
        shell: true,
      }
    );

    if (cypressResult.status !== 0) {
      console.error('\nSmoke test FAILED!');
      process.exitCode = 1;
    } else {
      console.log('\nSmoke test PASSED! Real production artifact correctly evaluates parity against Hugging Face model.');
    }
  } catch (err) {
    console.error('Smoke test error:', err);
    process.exitCode = 1;
  } finally {
    console.log('Stopping plain static server...');
    if (server.pid) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore' });
    }
  }
}

main();
