const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const ora = require('ora');
const Inquirer = require('inquirer');
const Metalsmith = require('metalsmith'); // 遍历文件夹 找到需要渲染的文件
// 统一所有的模板引擎
let { render } = require('consolidate').ejs;
let downloadGitRepo = require('download-git-repo');
let ncp = require('ncp');
const { downLoadDirectory } = require('./constants');

downloadGitRepo = promisify(downloadGitRepo);
ncp = promisify(ncp);
render = promisify(render);

// 创建项目
// 拉取所在项目列出来，让用户选 安装哪个项目 projectname
// 选择版本号
// https://api.github.com/orgs/zhu-cli/repos 获取组织下的仓库
// 需要配置一些数据 来结合自己的项目
// loading -> org
// 命令行选择 -> inquirer

// 1. 获取项目列表

const fetchRepoList = async () => {
  const { data } = await axios.get('https://api.github.com/orgs/zhu-cli/repos');
  return data;
};

// f封装loading 效果
const waitFnLoading = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
};

// 抓取tag列表
const fetchTagsList = async (repo) => {
  const { data } = await axios.get(`https://api.github.com/repos/zhu-cli/${repo}/tags`);
  return data;
};

// 下载
const downLoad = async (repo, tag) => {
  let api = `zhu-cli/${repo}`;
  if (tag) {
    api += `#${tag}`;
  }
  const dest = `${downLoadDirectory}/${repo}`;
  await downloadGitRepo(api, dest);
  return dest;
};

module.exports = async (projectname) => {
  let repos = await waitFnLoading(fetchRepoList, 'fetching template...')();
  repos = repos.map((item) => item.name);
  const { repo } = await Inquirer.prompt({
    name: 'repo',
    type: 'list',
    message: 'please choise a template to create project',
    choices: repos,
  });

  // 在获取之前 显示loading 关闭loading
  // 选择模板 inquirer

  // 2. 通过选择获取版本号
  const tags = await waitFnLoading(fetchTagsList, 'fetching tags...')(repo);
  const { tag } = await Inquirer.prompt({
    name: 'tag',
    type: 'list',
    message: 'please choise a tags to create project',
    choices: tags,
  });
  console.log(repo, tag); // 4. 下载模板
  // 3. 把模板下载到临时目录里 存好，以备后期使用

  const target = await waitFnLoading(downLoad, 'waiting download...')(repo, tag);
  // 4. 把临时文件夹 拷贝到执行命令的目录下
  // 目录下项目名字已经存在？？？
  //   await ncp(result, path.resolve(projectname));


  // 复杂模板
  // 把git上的项目下载下俩， 如果有ask文件就是一个复杂的模板，我们需要用户选择后编译

  if (!fs.existsSync(path.join(target, 'ask.js'))) {
    await ncp(target, path.resolve(projectname));
  } else {
    // 1. 用户选择信息
    await new Promise((resolve, reject) => {
      Metalsmith(__dirname) // 如果你传入路径， 默认会遍历当前src文件
        .source(target)
        .destination(path.resolve(projectname))
        .use(async (files, metal, done) => {
          // eslint-disable-next-line
          const args = require(path.join(target, 'ask.js'))
          const result = await Inquirer.prompt(args);
          const meta = metal.metadata();
          Object.assign(meta, result);
          delete files['ask.js'];
          done();
        })
        .use(async (files, metal, done) => {
          const obj = metal.metadata();
          Reflect.ownKeys(files).forEach(async (file) => {
            if (file.includes('.js') || file.includes('.json')) {
              let content = files[file].contents.toString();
              if (content.includes('<%')) {
                content = await render(content, obj);
                files[file].contents = Buffer.from(content);
              }
            }
          });
          done();
        })
        .build((err) => {
          console.log('复杂模板');
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });

    // 2. 通过选择的信息去渲染模板
  }
};
