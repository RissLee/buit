export default {
  target: 'browser',
  sourcemaps: true,
  cssModules: { prefix: 'buit-test' },
  extraBabelPlugins: [
    ['babel-plugin-import', { libraryName: 'antd', libraryDirectory: 'es', style: true }, 'antd'],
  ],
};
