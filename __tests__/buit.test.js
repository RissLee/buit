'use strict';

const fs = require('fs');
const build = require('../lib/build').default;
const rimraf = require('rimraf');

describe('buit', async () => {
  beforeAll(async () => {
    rimraf.sync('fixtures/lib');
    await build('fixtures', { cssModulesPrefix: 'my-pkg', target: 'browser' });
  });

  it('ts can be transform', () => {
    expect(require('../fixtures/lib/test1').itWorks()).toBe(true);
  });

  it('.* folder can be exclude', () => {
    expect(fs.existsSync('../fixtures/lib/.temp/test.js')).toBeFalsy();
  });
});
