const filePaths = require('./constants');
const recursivePathScanner = require('./recursivePathScanner');
const processRawFiles = require('../dbmanager/process_raw_files');


const scanAllDirs = async (dirs) => {
    return await Promise.all(Object.values(dirs).map(async dir => {
        return await recursivePathScanner(dir);
    }));
}

scanAllDirs(filePaths).then((files) => {
    const flatFiles = files.flat();
    const totalFileCount = flatFiles.length;
    console.log(totalFileCount);
    processRawFiles(flatFiles).then(() => { console.log('done') });
});