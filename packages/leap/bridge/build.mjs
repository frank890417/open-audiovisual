#!/usr/bin/env node
// build.mjs — compile leap-stream.c against the LeapC SDK that ships inside the Ultraleap app.
//
//   node packages/leap/bridge/build.mjs            # build if needed, print the binary's path
//   node packages/leap/bridge/build.mjs --force    # rebuild
//   LEAP_SDK=/path/to/LeapSDK node …/build.mjs     # another SDK location
//
// The binary is a machine artefact, not source: it is cached OUTSIDE git, keyed by a hash of
// the C source and the SDK path, so editing leap-stream.c or moving the SDK rebuilds it and
// two checkouts (main, a worktree) never fight over one file:
//   macOS   ~/Library/Caches/OpenAV/leap/leap-stream-<hash>
//   other   $XDG_CACHE_HOME (or ~/.cache)/openav/leap/leap-stream-<hash>
// leap-bridge.mjs calls ensureBinary() on start, so a fresh machine needs no separate step
// as long as clang (Xcode command line tools) is installed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE = path.join(HERE, 'leap-stream.c');
export const DEFAULT_SDK = '/Applications/Ultraleap Hand Tracking.app/Contents/LeapSDK';

export function sdkPath(env = process.env) { return env.LEAP_SDK || DEFAULT_SDK; }

export function cacheDir(env = process.env) {
  if (env.OPENAV_CACHE) return path.join(env.OPENAV_CACHE, 'leap');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'OpenAV', 'leap');
  return path.join(env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'openav', 'leap');
}

/** Where the binary for this source + SDK lives (it may not exist yet). */
export function binaryPath({ sdk = sdkPath(), source = SOURCE, env = process.env } = {}) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).update('\0' + sdk).digest('hex').slice(0, 10);
  return path.join(cacheDir(env), `leap-stream-${hash}`);
}

/** Build if missing (or forced). Returns the binary path; throws with a readable reason. */
export function ensureBinary({ sdk = sdkPath(), force = false, log = () => {} } = {}) {
  const out = binaryPath({ sdk });
  if (!force && fs.existsSync(out)) return out;
  const inc = path.join(sdk, 'include');
  const lib = path.join(sdk, 'lib');
  if (!fs.existsSync(path.join(inc, 'LeapC.h'))) {
    throw new Error(`LeapC SDK not found at ${sdk} — install Ultraleap Hand Tracking (https://leap2.ultraleap.com/downloads/) or set LEAP_SDK`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.${process.pid}.tmp`;
  log(`[leap] compiling leap-stream → ${out}`);
  try {
    execFileSync('clang', ['-O2', '-Wall', '-o', tmp, SOURCE, `-I${inc}`, `-L${lib}`, '-lLeapC', `-Wl,-rpath,${lib}`], { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw new Error(`clang failed (${e.message}) — install the Xcode command line tools: xcode-select --install`);
  }
  fs.renameSync(tmp, out);                       // atomic: a half-written binary is never run
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(ensureBinary({ force: process.argv.includes('--force'), log: (s) => console.error(s) }));
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
}
