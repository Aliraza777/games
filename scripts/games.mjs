#!/usr/bin/env node
/**
 * Tiny task runner for the games/ folder.
 *
 *   node scripts/games.mjs list
 *   node scripts/games.mjs new <name> [--no-install]
 *   node scripts/games.mjs run <script> <game> [-- extra args]
 *   node scripts/games.mjs run <script> --all
 *   node scripts/games.mjs install <game> | --all
 *
 * Games are deliberately independent (own package.json, lockfile and .vercel link)
 * so deploying one can never break another.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = process.env.GAMES_DIR ?? join(ROOT, 'games');
const TEMPLATE_DIR = join(ROOT, 'templates', 'starter');
const NAME_RE = /^[a-z][a-z0-9-]{1,38}$/;

const [, , command, ...rest] = process.argv;

function games() {
  if (!existsSync(GAMES_DIR)) return [];
  return readdirSync(GAMES_DIR)
    .filter((d) => existsSync(join(GAMES_DIR, d, 'package.json')))
    .sort();
}

function pkg(game) {
  return JSON.parse(readFileSync(join(GAMES_DIR, game, 'package.json'), 'utf8'));
}

function fail(msg) {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
}

function npm(args, cwd) {
  const res = spawnSync('npm', args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return res.status ?? 1;
}

function list() {
  const all = games();
  if (!all.length) return console.log('No games yet. Create one with: npm run new-game <name>');
  console.log('\nGames:\n');
  for (const g of all) {
    const p = pkg(g);
    const linked = existsSync(join(GAMES_DIR, g, '.vercel', 'project.json')) ? '  [vercel linked]' : '';
    const installed = existsSync(join(GAMES_DIR, g, 'node_modules')) ? '' : '  (run: npm run install:all)';
    console.log(`  ${g.padEnd(16)} ${p.description ?? ''}${linked}${installed}`);
  }
  console.log('\nRun one with: npm run dev -- <game>\n');
}

function resolveGame(name) {
  if (!name) fail(`Which game? Available: ${games().join(', ') || '(none)'}`);
  if (!games().includes(name)) fail(`No game "${name}". Available: ${games().join(', ')}`);
  return name;
}

function run(script, target, extra) {
  const targets = target === '--all' ? games() : [resolveGame(target)];
  const failed = [];
  for (const g of targets) {
    if (!pkg(g).scripts?.[script]) {
      if (target === '--all') console.log(`\n· ${g}: no "${script}" script, skipping`);
      else fail(`${g} has no "${script}" script`);
      continue;
    }
    console.log(`\n▶ ${g}: npm run ${script}${extra.length ? ' -- ' + extra.join(' ') : ''}`);
    const code = npm(['run', script, ...(extra.length ? ['--', ...extra] : [])], join(GAMES_DIR, g));
    if (code !== 0) failed.push(g);
  }
  if (failed.length) fail(`"${script}" failed in: ${failed.join(', ')}`);
}

function install(target) {
  const targets = target === '--all' ? games() : [resolveGame(target)];
  for (const g of targets) {
    console.log(`\n▶ ${g}: npm install`);
    if (npm(['install'], join(GAMES_DIR, g)) !== 0) fail(`npm install failed in ${g}`);
  }
}

/** Copy the starter template, replacing {{name}} / {{title}} tokens in text files. */
function scaffold(name, { install: doInstall }) {
  if (!NAME_RE.test(name ?? '')) fail('Game names are lowercase letters, digits and dashes, e.g. "star-catcher".');
  const dest = join(GAMES_DIR, name);
  if (existsSync(dest)) fail(`games/${name} already exists.`);
  const title = name
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

  cpSync(TEMPLATE_DIR, dest, { recursive: true });
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(json|html|md|ts|tsx|css|svg)$/.test(entry)) {
        const text = readFileSync(p, 'utf8');
        writeFileSync(p, text.replaceAll('{{name}}', name).replaceAll('{{title}}', title));
      }
    }
  };
  walk(dest);
  // npm strips .gitignore from published templates, so the template stores it as "gitignore".
  if (existsSync(join(dest, 'gitignore'))) cpSync(join(dest, 'gitignore'), join(dest, '.gitignore'));

  console.log(`\n✔ Created ${relative(ROOT, dest)}`);
  if (doInstall) install(name);
  console.log(`
Next steps:
  npm run dev -- ${name}          start it
  npm run test -- ${name}         run its tests
  cd games/${name} && vercel      link it to its own Vercel project (first deploy)
`);
}

switch (command) {
  case 'list':
  case undefined:
    list();
    break;
  case 'new':
    scaffold(rest[0], { install: !rest.includes('--no-install') });
    break;
  case 'run': {
    const [script, target, ...more] = rest;
    if (!script) fail('Usage: run <script> <game|--all>');
    const extra = more[0] === '--' ? more.slice(1) : more;
    run(script, target, extra);
    break;
  }
  case 'install':
    install(rest[0] ?? '--all');
    break;
  default:
    fail(`Unknown command "${command}". Try: list, new, run, install`);
}
