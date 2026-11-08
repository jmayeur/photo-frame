const config = require('../config');
const recursivePathScanner = require('./recursivePathScanner');
const processRawFiles = require('../dbmanager/process_raw_files');


const scanAllDirs = async (dirs) => {
    return await Promise.all(dirs.map(async dir => {
        return await recursivePathScanner(dir);
    }));
}

scanAllDirs(config.photoFolders).then((files) => {
    const flatFiles = files.flat();
    const totalFileCount = flatFiles.length;
    console.log(totalFileCount);
    processRawFiles(flatFiles).then(() => { console.log('done') });
});