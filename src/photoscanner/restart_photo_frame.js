const util = require('util');
const exec = util.promisify(require('child_process').exec);

// systemd owns fbi (it runs as root with a forced tty — fbi can't keep tty1
// when launched via sudo from a service). Rebuilding the playlist just restarts
// the unit; fbi picks up the new files.txt on start. The daily refresh runs as
// the pi user via cron, so this needs the scoped NOPASSWD rule install.sh adds.
const service = 'photos.service';

async function restartPhotoFrame() {
    const { stdout, stderr } = await exec(`sudo systemctl restart ${service}`);
    if (stderr) {
        console.log('stderr:', stderr);
    }
    if (stdout) {
        console.log(stdout);
    }
}

module.exports = restartPhotoFrame;
