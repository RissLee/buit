import { existsSync, statSync } from 'fs-extra';
import path, { join, relative, dirname } from 'path';
import vfs from 'vinyl-fs';
import Vinyl from 'vinyl';
import gulpBabel from 'gulp-babel';
import gulpIf from 'gulp-if';
import gulpTs from 'gulp-typescript';
import { TsConfig } from 'gulp-typescript/release/types';
import gulpLess from 'gulp-less';
import postcss from 'postcss';
import gulpPlumber from 'gulp-plumber';
import through from 'through2';
import chokidar from 'chokidar';
import lodash from 'lodash';
import rimraf from 'rimraf';
import sourcemaps from 'gulp-sourcemaps';
import { logger } from './logger';
import { IConfig, getBabelConfig, getPostcssPlugins } from './utils';

interface FileStat {
  path: string;
}
export default async function (opts: {
  cwd: string;
  config: IConfig;
  moduleType: string;
  watch: boolean;
  tsConfig: TsConfig;
}) {
  const { cwd, moduleType, config, watch, tsConfig } = opts;

  const srcPath = join(cwd, 'src');
  const targetDir = moduleType === 'esm' ? 'es' : 'lib';
  const targetPath = join(cwd, targetDir);

  const tsProject = gulpTs.createProject(tsConfig.compilerOptions || {});

  rimraf.sync(targetPath);

  function isTsFile({ path }: FileStat) {
    return /\.tsx?$/.test(path);
  }

  function isTsOrJsFile({ path }: FileStat) {
    return /\.[tj]sx?$/.test(path) && !path.endsWith('.d.ts');
  }

  function isLessFile({ path }: FileStat) {
    return /\.less$/.test(path);
  }

  function isCssFile({ path }: FileStat) {
    return /\.css$/.test(path);
  }

  function isScssFile({ path }: FileStat) {
    return /\.s[ac]ss$/.test(path);
  }

  function isCssLikeFile(f: FileStat) {
    return isLessFile(f) || isScssFile(f) || isCssFile(f);
  }

  function isBrowser({ path }: FileStat) {
    // tsx 文件始终为 browser 模式
    if (path.endsWith('.tsx')) return true;
    return config.target === 'browser';
  }

  // cache cssModules json
  const cssJsonCache: { [cssFilename: string]: object } = {};

  function createStream({
    patterns,
    skipErrorCrash,
  }: {
    patterns: string[];
    skipErrorCrash?: boolean; // error happen, not crash,use for watch mode
  }) {
    const lessConfig = {
      paths: [join(cwd, 'node_modules'), cwd],
      javascriptEnabled: true,
    };
    const browserBabelConfig = getBabelConfig({
      config: { ...config, target: 'browser' },
      moduleType,
    });
    const nodeBabelConfig = getBabelConfig({
      config: { ...config, target: 'node' },
      moduleType,
    });

    const postcssPlugins = getPostcssPlugins({ config, cssJsonCache });

    const files: Vinyl[] = [];

    return new Promise((resolve) => {
      vfs
        .src(patterns, {
          allowEmpty: true,
          base: srcPath,
        })
        .pipe(
          gulpIf(
            !!skipErrorCrash,
            gulpPlumber({
              errorHandler: function fn(error) {
                logger.error(error);
                // @ts-ignore
                this.emit('end');
              },
            })
          )
        )
        .pipe(
          gulpIf(
            isLessFile,
            through.obj((file, enc, cb) => {
              // replace @import "~"
              const reg = /@import\s+['"]~(.+)['"]/gi;
              const contents = file.contents.toString();
              if (reg.test(contents)) {
                file.contents = Buffer.from(contents.replace(reg, "@import '$1'"));
              }
              cb(null, file);
            })
          )
        )
        .pipe(gulpIf(isLessFile, gulpLess(lessConfig)))
        .pipe(
          through.obj(
            function (file, enc, cb) {
              files.push(file);
              cb();
            },
            async function (cb) {
              // postcss cssModule first
              await Promise.all(
                files.filter(isCssFile).map(async (f) => {
                  const result = await postcss(postcssPlugins).process(f.contents!, { from: f.path });
                  f.contents = Buffer.from(result.css);
                })
              );
              files.forEach((f) => this.push(f));
              cb();
            }
          )
        )
        .pipe(gulpIf((f) => !!config.sourcemaps && isTsOrJsFile(f), sourcemaps.init()))
        .pipe(
          gulpIf(
            (f: Vinyl) => isTsOrJsFile(f) && !!config.cssModules,
            through.obj((file, enc, cb) => {
              let contents: string = file.contents.toString();

              const cssReg = /import (.+) from\s+['"]((.+)\.(le|sc|sa|c)ss)['"]/gi;
              const imports = contents.match(cssReg);
              if (!imports?.length) {
                cb(null, file);
                return;
              }
              const cssJsonMapList: { varName: string; json: object; filePath: string; source: string }[] = [];
              for (const cssImport of imports) {
                const formatImport = cssImport.replace(/\s+/, ' ').replace(/['"]/g, '');
                const [, varName, , filePath] = formatImport.split(' ');
                // to css extname
                const cssFile = filePath.replace(path.extname(filePath), '.css');
                const fullFilePath = path.resolve(dirname(file.path), cssFile);
                let cssJson = cssJsonCache[fullFilePath];
                if (cssJson) {
                  cssJsonMapList.push({
                    varName,
                    filePath: cssFile,
                    json: cssJson,
                    source: cssImport,
                  });
                } else {
                  // maybe load external css
                  logger.error(
                    'maybe you load external css file,not support cssModules',
                    `"${formatImport}"`,
                    'at',
                    `"${file.path}"`
                  );
                }
              }
              const isTs = isTsFile(file);
              for (const { varName, filePath, json, source } of cssJsonMapList) {
                contents = contents.replace(
                  source,
                  `import '${filePath}';
                  const ${varName}${isTs ? ':{[key:string]:string}' : ''}=${JSON.stringify(json)}`
                );
              }
              file.contents = Buffer.from(contents);

              cb(null, file);
            })
          )
        )
        .pipe(gulpIf(isTsFile, tsProject()))
        .pipe(
          gulpIf(
            (f) => isTsOrJsFile(f) && isBrowser(f),
            // @ts-ignore
            gulpBabel(browserBabelConfig)
          )
        )
        .pipe(
          gulpIf(
            (f) => isTsOrJsFile(f) && !isBrowser(f),
            // @ts-ignore
            gulpBabel(nodeBabelConfig)
          )
        )
        .pipe(
          through.obj((file, env, cb) => {
            logger.info(`Transform to ${moduleType} for ${relative(cwd, file.path)}`);
            cb(null, file);
          })
        )
        .pipe(gulpIf((f) => !!config.sourcemaps && isTsOrJsFile(f), sourcemaps.write('.')))
        .pipe(vfs.dest(targetPath))
        .on('end', resolve);
    });
  }

  const ignoredFiles = ['mdx', 'md', '(test|e2e|spec).(js|jsx|ts|tsx)'];
  const ignoredDirectories = ['__test__', 'demos', 'fixtures'];
  const patterns = [
    join(srcPath, '**/*'),
    ...ignoredDirectories.map((d) => `!${join(srcPath, `**/${d}{,/**}`)}`),
    ...ignoredFiles.map((f) => `!${join(srcPath, `**/*.${f}`)}`),
  ];
  await createStream({ patterns });

  if (watch) {
    logger.title('watching...');
    // 递增的文件编译
    let files: string[] = [];

    // 增量编译，需引入申明文件，否则无法识别 *.css/*.png...等资源文件
    const declarationFile = join(srcPath, '**/*.d.ts');
    const compileFiles = () => {
      createStream({
        patterns: [...files, declarationFile],
        skipErrorCrash: true,
      });
      files.length = 0;
    };
    const debouncedCompileFiles = lodash.debounce(compileFiles, 1000);

    const watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
    });
    watcher.on('all', (event, fullPath) => {
      logger.info(`[${event}] [${moduleType}] ${relative(cwd, fullPath)}`);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        if (!files.includes(fullPath)) {
          files.push(fullPath);
        }
        debouncedCompileFiles();
      }
    });
  }
}
