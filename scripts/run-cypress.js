import { spawn, spawnSync } from 'child_process';
import http from 'http';

function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on('error', (err) => {
        // Log probing error
        if (Date.now() - start > timeout) {
          reject(new Error('Server start timed out after ' + timeout + 'ms. Last error: ' + err.message + ' (' + err.code + ')'));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

async function run() {
  console.log('Starting local server for Cypress test run...');
  const server = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    stdio: 'pipe',
  });

  let serverStartedResolve;
  const serverStartedPromise = new Promise((resolve) => {
    serverStartedResolve = resolve;
  });

  server.stdout.on('data', (d) => {
    const text = d.toString();
    process.stdout.write(text);
    if (text.includes('Server listening on') || text.includes('Data collection: ON')) {
      serverStartedResolve();
    }
  });
  server.stderr.on('data', (d) => process.stderr.write(d));

  try {
    await Promise.race([serverStartedPromise, waitForServer('http://127.0.0.1:3000')]);
    console.log('\nServer is responding. Running Cypress tests...');
    
    const spec = process.argv[2] || '';
    const args = ['cypress', 'run'];
    if (spec) {
      args.push('--spec', spec);
    }
    
    const result = spawnSync('npx.cmd', args, {
      stdio: 'inherit',
      shell: true,
    });
    process.exitCode = result.status ?? 0;
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('Stopping local test server...');
    if (server.pid) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore' });
    }
  }
}

run();
