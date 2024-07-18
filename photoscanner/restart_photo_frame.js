const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function restartPhotoFrame() {
    const { stdout, stderr } = await exec('bash "/home/pi/stopfbi.sh"');
    if (stderr) { console.log('stderr:', stderr); } else {
        const { stdout2, stderr2 } = await exec('bash "/home/pi/photo.sh"');
        if (stderr2) { console.log('stderr2:', stderr2); }
        console.log({ stdout, stdout2 })
    }
};

module.exports = restartPhotoFrame;