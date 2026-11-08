const util = require('util');
const exec = util.promisify(require('child_process').exec);

// fbi runs under the tty1 autologin loop (deploy/frame.sh) — full-KMS /dev/fb0
// needs a real login session that owns tty1, which a systemd service can't
// provide. So "restart the frame" just means kill fbi: the loop immediately
// relaunches it with the freshly rebuilt files.txt. fbi runs via sudo, so
// stopping it needs sudo too (the NOPASSWD rule install.sh adds covers pkill).
async function restartPhotoFrame() {
    await exec('sudo pkill fbi 2>/dev/null; true');
}

module.exports = restartPhotoFrame;
