const fs = require('fs-extra');
const path = require('path');

exports = module.exports = function (name) {};

exports.is_file = function (path) {
  try {
    const stats = fs.statSync(path);
    return stats.isFile();
  } catch (err) {
    return false;
  }
};

exports.is_dir = function (path) {
  try {
    const stats = fs.statSync(path);
    return stats.isDirectory();
  } catch (err) {
    return false;
  }
};

exports.delDir = function (path) {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach((file, index) => {
      let curPath = path + '/' + file;
      if (fs.statSync(curPath).isDirectory()) {
        this.delDir(curPath); //遞迴刪除資料夾
      } else {
        fs.unlinkSync(curPath); //刪除檔案
      }
    });
    fs.rmdirSync(path);
  }
};

exports.copyFolder = function (from, to) {
  fs.copy(from, to)
    .then(() => console.log('export completed!'))
    .catch((err) => {
      console.log('An error occured while copying the folder.');
      return console.error(err);
    });
};

exports.createFolder = function (dir) {
  fs.ensureDir(dir)
    .then(() => {
      // console.log('success!')
    })
    .catch((err) => {
      console.error(err);
    });
};

exports.remove = function (path) {
  fs.remove(path)
    .then(() => {
      // console.log('success!');
    })
    .catch((err) => {
      console.error(err);
    });
};
