import autoprefixer from 'autoprefixer';
import path from 'path';
import fs, { createWriteStream } from 'fs';
import { dirname } from 'path';
import { ensureDirSync, writeFileSync } from 'fs-extra';
// @ts-ignore
import postcssModules from 'postcss-modules';
import { IOpts } from '@umijs/babel-preset-umi';
import { merge } from 'lodash';
import { rcFile } from 'rc-config-loader';
import { TsConfig } from 'gulp-typescript/release/types';
import ts from 'typescript';
// @ts-ignore
import requireFromString from 'require-from-string';

const PKG_NAME = 'buit';

type Target = 'browser' | 'node';

export interface ICssModules {
  prefix?: string;
  generateScopedName?: string;
  [key: string]: any;
}

export interface IConfig {
  target: Target;
  cssModules?: ICssModules | boolean;
  extraBabelPresets?: any[];
  extraBabelPlugins?: any[];
  sourcemaps?: boolean;
  runtimeHelpers?: object;
  notClean?: boolean;
}

export const defaultConfig: IConfig = {
  target: 'browser',
};

// command config
export function getConfig(): IConfig {
  let config: IConfig = {
    target: 'node',
  };
  // .ts
  const filename = `.${PKG_NAME}rc.ts`;
  const tsRcPath = path.resolve(filename);
  if (fs.existsSync(tsRcPath)) {
    // ts -> js
    const result = require('@babel/core').transformSync(fs.readFileSync(tsRcPath, 'utf-8'), {
      filename,
      ...getBabelConfig({ config: { target: 'node' } }),
    });
    config = requireFromString(result.code).default;
  } else {
    try {
      // rc-config-loader 只支持  [".json", ".yaml", ".yml", ".js"]
      const result = rcFile<IConfig>(PKG_NAME);
      if (result) {
        config = result.config as IConfig;
      }
    } catch {}
  }

  return merge({}, defaultConfig, config);
}

export function getTSConfig({ cwd }: { cwd: string }): TsConfig {
  const tsConfigFile = ts.findConfigFile(cwd, ts.sys.fileExists);
  if (tsConfigFile) {
    return JSON.parse(fs.readFileSync(tsConfigFile, 'utf-8'));
  }
  return {};
}

// babel config
export function getBabelConfig({ config, moduleType }: { config: IConfig; moduleType?: string }) {
  const presetOptions: IOpts = {
    typescript: true,
    react: {},
    env: {
      targets:
        config.target === 'browser' ? { browsers: ['last 2 versions', 'IE 10'] } : { node: 10 },
      modules: moduleType === 'esm' ? false : 'auto',
    },
    transformRuntime: config.runtimeHelpers,
  };

  const presets = [[require.resolve('@umijs/babel-preset-umi'), presetOptions]];

  const plugins = [];
  if (config.cssModules) {
    plugins.push([
      'css-modules-transform',
      {
        extensions: ['.css', '.scss', '.less', '.sass'],
        generateScopedName: getGenerateScopedName(config),
        keepImport: true,
      },
    ]);
  }

  return {
    presets: [...presets, ...(config.extraBabelPresets || [])],
    plugins: [...plugins, ...(config.extraBabelPlugins || [])],
  };
}

// postcss config
export function getPostcssPlugins(config: IConfig): any[] {
  const plugins = [autoprefixer()];
  if (config.cssModules) {
    plugins.push(
      postcssModules({
        generateScopedName: getGenerateScopedName(config),
        getJSON() {},
        ...(config.cssModules as object),
      }),
    );
  }
  return plugins;
}

// get cssModules.generateScopedName
export function getGenerateScopedName(config: IConfig): string {
  const { cssModules } = config;
  if (!cssModules) {
    return '';
  }

  let generateScopedName = '[local]__[hash]';
  if (typeof cssModules === 'object') {
    if (cssModules.generateScopedName) {
      generateScopedName = cssModules.generateScopedName;
      // short
    } else if (cssModules.prefix) {
      generateScopedName = `${cssModules.prefix}-[local]`;
    }
  }
  return generateScopedName;
}

function transformImportLess2Css() {
  return {
    name: 'transform-import-less-to-css',
    visitor: {
      ImportDeclaration(path: string, source: {}) {
        const re = /\.less$/;
        // @ts-ignore
        if (re.test(path.node.source.value)) {
          // @ts-ignore
          path.node.source.value = path.node.source.value.replace(re, '.css');
        }
      },
    },
  };
}
