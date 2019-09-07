const fs = require('fs')
const { encode, decode } = require('ini')
const { defaultConfig, configFile } = require('./utils/constants')  

module.exports = (action, key, val) => {
    const flag = fs.existsSync(configFile)
    const obj = {}
    if(flag) {
        const content = fs.readFileSync(configFile).toString()
        const contentDecoded = decode(content);// 将文件解析成对象
        Object.assign(obj, contentDecoded)
    }

    if(action === 'get') {
        console.log(obj, obj[key] || defaultConfig[key]);
        return obj[key] || defaultConfig[key]
    } else if(action === 'set') {
        obj[key] = val;
        fs.writeFileSync(configFile, encode(obj))
        console.log(`${key}=${v}`)
        console.log('设置')
    } else if(action === 'getVal') {
        return obj[key]
    }
}   