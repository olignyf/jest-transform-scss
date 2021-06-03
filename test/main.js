/*eslint new-cap: ["error", {"capIsNewExceptions": ["Color"]}]*/

var assert = require('assert').strict,
  fs = require('fs'),
  path = require('path'),
  read = fs.readFileSync,
  jestTransformScss = require('../index'),
  fixture = path.join.bind(null, __dirname, 'fixtures'),
  expected = path.join.bind(null, __dirname, 'expected');

describe('jest-transform-scss', function() {

  describe('handle @import properly', function() {
    var src = read(fixture('include-files/index.scss'), 'utf8');

    it('first.', function(done) {
      const testInputFilename = fixture('include-files/chained-imports-with-custom-importer.scss');
      const input = fs.readFileSync(testInputFilename, { encoding: 'utf8' });
      const result = jestTransformScss.process(input, testInputFilename);
      assert.strictEqual(
      result.trim(),
`const styleInject = require('style-inject');

styleInject("body {\\n  color: \\"red\\"; }\\n");
module.exports = {};`);
      done();
    });
    
    it('should import boostrap SCSS from tilde declaration', function(done) {
      const testInputFilename = fixture('include-files/import-bootstrap-scss-from-tilde.scss');
      const testExpectedFilename = expected('import-bootstrap-scss-from-tilde.txt');
      const input = fs.readFileSync(testInputFilename, { encoding: 'utf8' });
      const result = jestTransformScss.process(input, testInputFilename);
      //fs.writeFileSync(testExpectedFilename, result, { encoding: 'utf8' });
      const expectedContent = fs.readFileSync(testExpectedFilename, { encoding: 'utf8' });
      assert.strictEqual(result, expectedContent);
      done();
    });
    
    it('should import boostrap CSS from tilde declaration', function(done) {
      const testInputFilename = fixture('include-files/import-bootstrap-css-from-tilde.scss');
      const testExpectedFilename = expected('import-bootstrap-css-from-tilde.txt');
      const input = fs.readFileSync(testInputFilename, { encoding: 'utf8' });
      const result = jestTransformScss.process(input, testInputFilename);
      //fs.writeFileSync(testExpectedFilename, result, { encoding: 'utf8' });
      const expectedContent = fs.readFileSync(testExpectedFilename, { encoding: 'utf8' });
      assert.strictEqual(result, expectedContent);
      done();
    });
  });
});
