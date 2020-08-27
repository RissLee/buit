const path = require('path');
const fs = require('fs-extra');
const { src, watch, series, dest } = require('gulp');
const gulpClean = require('gulp-clean');
const gulpBabel = require('gulp-babel');
const gulpTs = require('gulp-typescript');
const through2 = require('through2');
const sourcemaps = require('gulp-sourcemaps');
const gulpLess = require('gulp-less');
const postcss = require('gulp-postcss');
const gulpPlumber = require('gulp-plumber');
const postcssModules = require('postcss-modules');
const autoprefixer = require('autoprefixer');
const tsConfig = require('./tsconfig.json');

const cwd = path.resolve('.');

const JS_GLOBS = ['src/**/*.tsx', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.js'];
async function transformJs() {
  src(JS_GLOBS, { cwd })
    .pipe(
      gulpPlumber({
        errorHandler: function cb(error) {
          console.log(error);
          this.emit('end');
        },
      })
    )
    .pipe(sourcemaps.init())
    .pipe(
      // 替换less=>.css.json
      through2.obj(function run(file, enc, cb) {
        file.contents = Buffer.from(
          file.contents.toString().replace(
            /import (.+) from\s+['"](.+)\.less['"]/i,
            `// @ts-ignore
            import $1 from '$2.css.json'
            import '$2.css'
            `
          )
        );
        this.push(file);
        cb();
      })
    )
    .pipe(gulpTs(tsConfig.compilerOptions))
    .pipe(
      gulpBabel({
        presets: [
          [
            require.resolve('@umijs/babel-preset-umi'),
            {
              typescript: true,
              react: true,
              env: {
                targets: { node: 10 },
                modules: 'auto',
              },
            },
          ],
        ],
        plugins: [['babel-plugin-import', { libraryName: 'antd', libraryDirectory: 'es', style: true }, 'antd']],
      })
    )
    .pipe(sourcemaps.write('.'))
    .pipe(dest('lib', { cwd }));
}

// 'src/**/*.css'
const LESS_GLOBS = 'src/**/*.less';
async function transformLess() {
  return src(LESS_GLOBS, { cwd })
    .pipe(
      // 替换@import "~"
      through2.obj(function run(file, enc, cb) {
        file.contents = Buffer.from(
          file.contents.toString().replace(
            /@import\s+['"]~(.+)['"]/i,
            `@import '$1'
            `
          )
        );
        this.push(file);
        cb();
      })
    )
    .pipe(gulpLess({ paths: ['.'], javascriptEnabled: true }))
    .pipe(
      through2.obj(function run(file, enc, cb) {
        this.pipe(
          postcss([
            autoprefixer(),
            postcssModules({
              getJSON(cssFileName, json, _outputFileName) {
                const dir = path.dirname(cssFileName);
                fs.ensureDirSync(dir);
                fs.writeFileSync(`${cssFileName}.json`, JSON.stringify(json));
              },
              generateScopedName: 'kb-layout-[local]',
              camelCase: true,
              scopeBehaviour: 'local',
            }),
          ])
        );
        this.push(file);
        cb();
      })
    )
    .pipe(dest('lib', { cwd }));
}

// clean lib dir
function clean() {
  return src('lib', { read: false, allowEmpty: true, cwd }).pipe(gulpClean());
}

async function runWatch() {
  watch(JS_GLOBS, { cwd }, transformJs);
  watch(LESS_GLOBS, { cwd }, transformLess);
}

exports.clean = clean;

exports.build = series(transformJs, transformLess);

exports.watch = runWatch;
