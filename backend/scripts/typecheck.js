#!/usr/bin/env node
// Backend is plain CommonJS with no TypeScript, so there is no type system to
// check. This validates syntax across every source file with `node --check`,
// which is the closest honest equivalent - it catches malformed JS before it
// ever reaches production, without pretending to type-check untyped code.
const { execFileSync } = require('child_process');
const path = require('path');
const { readdirSync, statSync } = require('fs');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['src', 'scripts', 'test'];

function collectJsFiles(dir) {
    let files = [];
    for (const entry of readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(collectJsFiles(fullPath));
        } else if (entry.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

let files = [];
for (const dir of TARGET_DIRS) {
    const fullDir = path.join(ROOT, dir);
    try {
        files = files.concat(collectJsFiles(fullDir));
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

let failed = false;
for (const file of files) {
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
        failed = true;
        console.error(`Syntax error in ${path.relative(ROOT, file)}:`);
        console.error(err.stderr.toString());
    }
}

if (failed) {
    process.exit(1);
}

console.log(`Typecheck (syntax) passed for ${files.length} files.`);
