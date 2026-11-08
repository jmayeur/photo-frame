// Find the original NAS path(s) for a photo currently in the frame's rotation.
// Pass any part of the filename shown on screen by fbi's -v overlay.
//   npm run whereis -- 2010-08-11
const fs = require('fs');
const path = require('path');
const config = require('../config');

const term = (process.argv[2] || '').toLowerCase();
if (!term) {
    console.error('usage: npm run whereis -- <part of the on-screen filename>');
    process.exit(1);
}

const manifest = path.join(config.cacheDir, 'manifest.tsv');
let lines;
try {
    lines = fs.readFileSync(manifest, 'utf8').split('\n');
} catch {
    console.error(`No manifest at ${manifest} — run the daily refresh first.`);
    process.exit(1);
}

const hits = lines
    .filter((l) => l.toLowerCase().includes(term))
    .map((l) => l.split('\t')[1])
    .filter(Boolean);

if (hits.length === 0) {
    console.log('No match in the current rotation.');
} else {
    hits.forEach((h) => console.log(h));
}
