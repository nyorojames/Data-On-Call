import { spawn } from 'child_process';

process.env.DATA_COLLECTION = '1';

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const child = spawn(npxCmd, ['tsx', 'server.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DATA_COLLECTION: '1',
  },
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
