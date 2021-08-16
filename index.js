const fs = require("fs");
const crypto = require("crypto");
const crossSpawn = require("cross-spawn");
const cosmiconfig = require("cosmiconfig");
const stripIndent = require("common-tags/lib/stripIndent");
const THIS_FILE = fs.readFileSync(__filename);
const explorer = cosmiconfig("jesttransformcss");
const transformConfig = explorer.searchSync();
const sass = require('node-sass');
const path = require('path');
const fixture = path.join.bind(null, __dirname, 'test/fixtures');
const searchPaths = {
   curdir: path.join.bind(null, __dirname),
   node_modules:  path.join.bind(null, __dirname, "node_modules")
};

module.exports = {
  getCacheKey: (fileData, filename, configString, { instrument }) => {
    return (
      crypto
        .createHash("md5")
        .update(THIS_FILE)
        .update("\0", "utf8")
        .update(fileData)
        .update("\0", "utf8")
        .update(filename)
        .update("\0", "utf8")
        .update(configString)
        .update("\0", "utf8")
        .update(JSON.stringify(transformConfig))
        // TODO load postcssrc (the config) sync and make it part of the cache
        // key
        // .update("\0", "utf8")
        // .update(getPostCssConfig(filename))
        .update("\0", "utf8")
        .update(instrument ? "instrument" : "")
        .digest("hex")
    );
  },

  process: (src, filename, config, options) => {
    // skip when plain CSS is used
    // You can create jesttransformcss.config.js in your project and add
    // module.exports = { modules: true };
    // or
    // module.exports = { modules: filename => filename.endsWith(".mod.css") };
    // to enable css module transformation. for all or for certain files.
    const useModules =
      transformConfig &&
      transformConfig.config &&
      ((typeof transformConfig.config.modules === "boolean" &&
        transformConfig.config.modules) ||
        (typeof transformConfig.config.modules === "function" &&
          transformConfig.config.modules(filename)));

    if (!useModules) {

      if (filename.match(/\.scss$/)) {
        // convert SCSS to CSS 
        const resultSass = sass.renderSync({
          data: src,
          importer: function(url, prev, done) {
            // console.log('importer', url, prev, done);
            let location1, location2, location3, location4;
            if (prev && prev !== 'stdin') {
              // include within a previous file
              const directory = path.dirname(prev);
              location1 = path.join(directory, url);
            } else if (url.indexOf('~') === 0) {
              // node_modules
              location1 = searchPaths.node_modules(url.substring(1));
              location2 = searchPaths.node_modules(url.substring(1) + '.scss');              
            } else {
              location1 = url;
              location2 = searchPaths.curdir(url);
              location3 = searchPaths.curdir(url + '.scss');
              location4 = fixture('include-files/' + url + '.scss'); // unit tests
            }

            const checkIfWeShouldIncludeContentDirectly = (location) => {
               if (location.endsWith('.css')) {
                return true;
               }
            };

            const returnRoutine = (location) => {
              const viaContent = checkIfWeShouldIncludeContentDirectly(location);
              if (viaContent) {
                return {
                  contents: fs.readFileSync(location, {encoding: 'utf8'})
                };
              }
              return {
                file: location
              };
            };

            if (fs.existsSync(location1)) {
              return returnRoutine(location1);
            }
            if (fs.existsSync(location2)) {
              return returnRoutine(location2);
            }
            if (fs.existsSync(location3)) {
              return returnRoutine(location3);
            }
            if (fs.existsSync(location4)) {
              return returnRoutine(location4);
            }
            return sass.NULL;
          }
        });
      
        return stripIndent`
          const styleInject = require('style-inject');

          styleInject(${JSON.stringify(resultSass.css.toString())});
          module.exports = {};
        `;
      } else {
        // plain CSS
        return stripIndent`
          const styleInject = require('style-inject');

          styleInject(${JSON.stringify(src)});
          module.exports = {};
        `;
      }
    }

    // The "process" function of this Jest transform must be sync,
    // but postcss is async. So we spawn a sync process to do an sync
    // transformation!
    // https://twitter.com/kentcdodds/status/1043194634338324480
    const postcssRunner = `${__dirname}/postcss-runner.js`;
    const result = crossSpawn.sync("node", [
      "-e",
      stripIndent`
        require("${postcssRunner}")(
          ${JSON.stringify({
            src,
            filename,
            transformConfig: transformConfig.config
            // options
          })}
        )
        .then(out => { console.log(JSON.stringify(out)) })
      `
    ]);

    // check for errors of postcss-runner.js
    const error = result.stderr.toString();
    if (error) throw error;

    // read results of postcss-runner.js from stdout
    let css;
    let tokens;
    try {
      // we likely logged something to the console from postcss-runner
      // in order to debug, and hence the parsing fails!
      parsed = JSON.parse(result.stdout.toString());
      css = parsed.css;
      tokens = parsed.tokens;
      if (Array.isArray(parsed.warnings))
        parsed.warnings.forEach(warning => {
          console.warn(warning);
        });
    } catch (error) {
      // we forward the logs and return no mappings
      console.error(result.stderr.toString());
      console.log(result.stdout.toString());
      return stripIndent`
        console.error("transform-css: Failed to load '${filename}'");
        module.exports = {};
      `;
    }

    // Finally, inject the styles to the document
    return stripIndent`
      const styleInject = require('style-inject');

      styleInject(${JSON.stringify(css)});
      module.exports = ${JSON.stringify(tokens)};
    `;
  }
};
