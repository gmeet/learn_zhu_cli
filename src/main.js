// 找到要执行的核心文件
// 1. 要解析用户的参数
const path = require('path');
const program = require('commander');
const { version } = require('./constants');

const mapActions = {
  create: {
    alias: 'c',
    description: 'create a project',
    examples: [
      'yui-cli create <project-name>',
    ],
  },
  config: {
    alias: 'conf',
    description: 'config project veriable',
    examples: ['yui-cli config set <k> <v>',
      'yui-cli config get <k>'],
  },
  '*': {
    alias: '',
    description: 'command not found',
    examples: [],
  },
};


Reflect.ownKeys(mapActions).forEach((key) => {
  const val = mapActions[key];
  program
    .command(key)
    .alias(val.alias)
    .description(val.description)
    .action(() => {
      if (key === '*') { // 访问不到命令
        console.log(val.description);
      } else {
        // eslint-disable-next-line
        require(path.resolve(__dirname, key))(...process.argv.slice(3));
      }
    });
});

// 监听用户help 事件
program.on('--help', () => {
  console.log('\nExamples:\r\r');
  Reflect.ownKeys(mapActions).forEach((key) => {
    const val = mapActions[key];
    val.examples.forEach((example) => {
      console.log(` ${example}`);
    });
    console.log('');
  });
});

// program
//   .command('create') // 配置命令的名称
//   .alias('c') // 配置命令的别名
//   .description('create a project') // 配置命令的描述
//   .action(() => { // 配置命令执行的动作
//     console.log('create');
//   });

// 先配置命令-然后解析命令
// 解析用户传递过来的参数
program
  .version(version)
  .parse(process.argv);
