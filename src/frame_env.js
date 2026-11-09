// Emit the frame's runtime settings as shell-sourceable lines, so the bash
// launcher (frame.sh) and the client pull (sync.sh) stay generic while
// config.json remains the single source of truth. install.sh writes the output
// to ~/.frame.env; re-run `node src/frame_env.js > ~/.frame.env` after editing config.
const config = require('./config');

const fbi = config.fbi || {};
const device = fbi.device || '/dev/fb0';
const tty = fbi.tty != null ? fbi.tty : 1;
const interval = fbi.intervalSec != null ? fbi.intervalSec : 30;
const verbose = fbi.verbose !== false; // default on; set fbi.verbose=false to hide the filename overlay

// -a autozoom (fit any panel, so a shared cache sized for another frame still
// scales correctly), -u random order, and the verbose toggle for the on-image
// filename. ORDER MATTERS: fbi exits right after loading its font if short `-v`
// immediately follows `-u` (the original photo.sh always used `-a -v -u`). So
// emit each case in its proven-working order rather than a single template.
const tail = verbose ? '-a -v -u' : '-a -u --noverbose';
const fbiOpts = `-d ${device} -T ${tty} -t ${interval} ${tail}`;

const lines = [
    `FBI_OPTS="${fbiOpts}"`,
    `LIST="${config.playlist}"`,
    `CACHE_DIR="${config.cacheDir}"`,
];

// A frame with a `source` is a display-only client: it pulls the primary's
// prepared playlist + cache instead of scanning the NAS itself.
if (config.source && config.source.host) {
    const s = config.source;
    lines.push(`SRC_USER="${s.user || 'pi'}"`);
    lines.push(`SRC_HOST="${s.host}"`);
    lines.push(`REMOTE_CACHE="${s.remoteCacheDir || config.cacheDir}"`);
    lines.push(`REMOTE_LIST="${s.remotePlaylist || config.playlist}"`);
}

process.stdout.write(lines.join('\n') + '\n');
