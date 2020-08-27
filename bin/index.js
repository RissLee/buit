#!/usr/bin/env node

const { Command } = require('commander');
const pkg = require('../package.json');
const build = require('../lib/build').default;

const program = new Command();
program.version(pkg.version);

program
  .command('build [path]')
  .description(`build src dir, if assign path, will transform './{path}/src' -> './{path}/lib'`)
  .option('-w, --watch', 'watch change')
  .option('-t, --target', 'target node or browser, default: node')
  .option('-c, --cssModules [generateScopedName]', 'open cssModules with generateScopedName, default: [local]__[hash]')
  .option(
    '-cp, --cssModulesPrefix <prefix>',
    `open cssModules and generateScopedName prefix short for [prefix]-[local]`
  )
  .action((path, { watch, target, cssModules, cssModulesPrefix }) => {
    build(path, { watch, cssModules, cssModulesPrefix });
  });

program.parse(process.argv);
