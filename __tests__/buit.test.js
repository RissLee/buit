'use strict';

const build = require('../lib/build').default;
const rimraf = require('rimraf');

describe('buit', () => {
  it('buid test', async () => {
    rimraf.sync('fixtures/lib');
    await build('fixtures', { cssModulesPrefix: 'my-pkg', target: 'browser' });

    expect(require('../fixtures/lib/test1').itWorks()).toBe(true);
  });
});
