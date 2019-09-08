// 存放常量
const { version } = require('../package.json');

// 存储模板的位置
const downLoadDirectory = `${process.env[process.platform === 'darwin' ? 'HOME' : 'USERPROFILE']}/.template`;
module.exports = {
  version,
  downLoadDirectory,
};
