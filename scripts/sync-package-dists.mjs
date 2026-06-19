import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const builtPackagesRoot = path.join(backendRoot, 'dist', 'packages');

const packageTargets = [
  {
    name: 'slatrap-engine',
    source: path.join(builtPackagesRoot, 'slatrap-engine', 'src'),
    destination: path.join(
      backendRoot,
      'packages',
      'slatrap-engine',
      'dist',
      'src',
    ),
  },
  {
    name: 'slatrap',
    source: path.join(builtPackagesRoot, 'slatrap', 'src'),
    destination: path.join(backendRoot, 'packages', 'slatrap', 'dist', 'src'),
  },
];

for (const target of packageTargets) {
  if (!existsSync(target.source)) {
    throw new Error(`Missing build output for package '${target.name}' at ${target.source}`);
  }

  await rm(target.destination, { recursive: true, force: true });
  await mkdir(path.dirname(target.destination), { recursive: true });
  await cp(target.source, target.destination, { recursive: true });
}