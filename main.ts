// The gta6-01 entry point (Node 22, standard library only): AURELIA BAY: Golden Hour, an
// original open-world crime game. The game is this directory's game/ folder - plain static
// files a desktop browser loads offline (game/index.html plus vanilla ES modules, no
// library, no build step, no network, all art drawn in code) - and the four screenshots
// beside it. This program stages the hand-in: it copies game/ and screenshots/ to the
// output directory and writes dossier.json, the summary the judge reads, via the vendored
// make.fun library.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Stage the hand-in outside the grader's container with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, readGameTree } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path under
// game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// A short staging summary on stdout, so the recorder and the grader's log show what was
// handed in: the game tree totals, the screenshots, and the dossier's size.
const tree = readGameTree(join(out, 'game'), { game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 });
const shots = readdirSync(join(out, 'screenshots')).filter((name: string) => !name.startsWith('.')).sort();
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`staged ${tree.files.length} game files (${tree.totalBytes} bytes), screenshots: ${shots.join(', ')}, dossier: ${dossierBytes} bytes`);
