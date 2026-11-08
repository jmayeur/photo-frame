const util = require('util');
const exec = util.promisify(require('child_process').exec);
const config = require('../config');

async function restartPhotoFrame() {
    const { stdout, stderr } = await exec(`bash "${config.scripts.stopFbi}"`);
    if (stderr) { console.log('stderr:', stderr); } else {
        const { stdout2, stderr2 } = await exec(`bash "${config.scripts.startPhoto}"`);
        if (stderr2) { console.log('stderr2:', stderr2); }
        console.log({ stdout, stdout2 })
    }
};

module.exports = restartPhotoFrame;