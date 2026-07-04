#!/usr/bin/env node
// Picocart CLI. `npx picocart create <project-name>` will scaffold a deploy
// template once one is published.

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PACKAGE_NAME = 'picocart';

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  process.stdout.write(`picocart — open-source headless commerce

Usage:
  npx picocart create <project-name>   Scaffold a new picocart deploy project (coming soon)
  npx picocart --help                  Show this message
  npx picocart --version               Print version
`);
}

export async function runCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    printHelp();
    return;
  }
  if (args[0] === '-v' || args[0] === '--version') {
    process.stdout.write(`${PACKAGE_NAME} v${readVersion()}\n`);
    return;
  }
  if (args[0] === 'create') {
    process.stdout.write('picocart create is not available yet — deploy template scaffolding is coming in a future release.\n');
    return;
  }
  process.stderr.write(`Unknown command: ${args[0]}\n\n`);
  printHelp();
  process.exit(1);
}

const isMain = (() => {
  try {
    if (!process.argv[1]) return false;
    const here = fileURLToPath(import.meta.url).toLowerCase();
    const invoked = resolve(process.argv[1]).toLowerCase();
    return here === invoked;
  } catch {
    return false;
  }
})();

if (isMain) {
  runCli(process.argv).catch((err) => {
    process.stderr.write(`Fatal: ${err?.message ?? err}\n`);
    if (err?.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(1);
  });
}
