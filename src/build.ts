import fs from 'fs';
import path from 'path';
import colors from 'colors';
import babel from './babel';
import { logger } from './logger';
import { getConfig, getTSConfig } from './utils';

interface Params {
  watch: boolean;
  target?: string;
  cssModules?: boolean | string;
  cssModulesPrefix?: string;
}

export default async (pkgPath: string, { watch, target, cssModules, cssModulesPrefix }: Params) => {
  let cwd = process.cwd();
  if (pkgPath) {
    if (!fs.existsSync(pkgPath)) {
      logger.error(colors.red(`Not found package in '${pkgPath}'`));
      return;
    }
    cwd = path.join(cwd, pkgPath);
  }

  logger.title(pkgPath ? `build package: ${pkgPath}` : 'build current package');

  const tsConfig = getTSConfig({ cwd });

  const config = getConfig();
  if (cssModules || cssModulesPrefix) {
    if (typeof cssModules === 'string') {
      config.cssModules = { generateScopedName: cssModules };
    } else if (cssModulesPrefix) {
      config.cssModules = { prefix: cssModulesPrefix };
    } else {
      config.cssModules = true;
    }
  }
  if (target === 'browser') {
    config.target = target;
  }

  return babel({
    cwd,
    watch,
    config,
    moduleType: 'lib',
    tsConfig,
  });
};
