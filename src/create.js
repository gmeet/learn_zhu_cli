const path = require('path')
const { promisify }  = require('util')
const fs = require('fs')

const axios = require('axios')
const ora = require('ora')
const inquirer = require('inquirer')
const downLoadGitRepo = require('download-git-repo')
const Metalsmith = require('metalsmith')
const chalk = require('chalk')

let ncp = require('ncp')
let { render } = require('consolidate').ejs

const config = require('./config')
const repoUrl = config('get', 'newRepo')

console.log('配置', repoUrl)

const cliName = 'zhu-cli'
const baseUrl_orgs = `https://api.github.com/orgs/${cliName}`// orgs
const baseUrl_repos = `https://api.github.com/repos/${cliName}` // tag


// 转为promise格式
const downLoadGit = promisify(downLoadGitRepo);
ncp = promisify(ncp)
render = promisify(render)
// 获取当前文件目录
const downLoadDirectory = `${process.env[process.platform === 'darwin' ? 'HOME': 'USERPROFILE']}/.template`

const chalkSuccess = (text) => console.log(chalk.green(text))
const chalkError = (text) => console.log(chalk.red(text))

// 获取仓库列表
const fetchRepoList = async () => {
    const { data } = await axios.get(`${baseUrl_orgs}/repos`);
    return data
}

// 获取版本信息列表
const fetchTagsList = async (repo) => {
    const { data } = await axios.get(`${baseUrl_repos}/${repo}/tags`);
    return data;
  };

// 下载项目
const downLoad = async (repo, tag) => {
    let api = `${cliName}/${repo}`;// 下载项目
    if(tag) {
        api += `#${tag}`
    }

    const dest = `${downLoadDirectory}/${repo}`
    await downLoadGit(api, dest);
    return dest
}

// 提示信息包裹函数
const wrapFetchAddLoading = (fn, message) => async (...args) => {
    const spinner = ora(message);
    spinner.start()
    const r = await fn(...args);
    spinner.succeed()
    return r
}

module.exports = async (projectName) => {
    let repos = await wrapFetchAddLoading(fetchRepoList, '正在获取模板中，请稍后...')()
    // 选择模板
    repos = repos.map(item => item.name);
    const { repo } = await inquirer.prompt({
        name: 'repo',
        type: 'list',
        message: '请选择一个模板来创建项目',
        choices: repos
    })

    // 选择版本
    let tags = await wrapFetchAddLoading(fetchTagsList, '正在获取版本号，请稍等...')(repo)
    tags = tags.map(item => item.name);

    const { tag } = await inquirer.prompt({
        name: 'tag',
        type: 'list',
        message: '请选择版本',
        choices: tags
    })


    // 下载项目
    const target = await wrapFetchAddLoading(downLoad, 'download template')(repo, tag)
    console.log(target)

    // 没有ask文件说明不需要编译
    if(!fs.existsSync(target, 'ask.js')) {
        // 将下载的文件拷贝到当前执行命令的目录下
        await ncp(target, path.join(path.resolve(), projectName))
        chalkSuccess(`创建项目成功 请执行\n cd ${projectName}`)
    } else {

        const askUrl = path.join(target, 'ask.js')
        await new Promise((resolve, reject) => {
            Metalsmith(__dirname)
                .source(target)
                .destination(path.resolve(projectName))
                .use(async (files, metal, done) => {
                    const result = await inquirer.prompt(require(askUrl))
                    const data = metal.metadata()
                    // 将询问的结果放在metaData中保证在下一个中间价中可以获取到
                    Object.assign(data, result); 

                    delete files['ask.js']
                    done()
                })
                .use(async (files, metal, done) => {
                    Reflect.ownKeys(files).forEach(async (file) => {
                        let content = files[file].contents.toString(); // 获取文件中的内容
                        if(file.includes('.js') || file.includes('.json')) {
                            if(content.includes('<%')) {
                                // 文件中用<% 我才需要编译
                                content = await render(content, metal.metadata()) // 用数据渲染模板
                                files[file].contents = Buffer.from(content)  // 渲染好的结果替换即可
                            }
                        }
                    })
                    // 不能少
                    done();
                })
                .build(err => {
                    // 执行中间件
                    if(!err) {
                        chalkSuccess(`创建项目成功 请执行cd ${projectName}`)
                        resolve()
                    } else {
                        chalkError(err)
                        reject()
                    }
                })
        })
    }
}
