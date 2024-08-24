import { resolve } from 'path';
import envVars from 'preact-cli-plugin-env-vars';

export default {
  /**
   * Function that mutates the original webpack config.
   * Supports asynchronous changes when a promise is returned (or it's an async function).
   *
   * @param {object} config - original webpack config.
   * @param {object} env - options passed to the CLI.
   * @param {WebpackConfigHelpers} helpers - object with useful helpers for working with the webpack config.
   * @param {object} options - this is mainly relevant for plugins (will always be empty in the config), default to an empty object
   **/
  webpack(config, env, helpers, options) {
    envVars(config, env, helpers);
    config.output.library = 'plm-annotator-outer';
    config.output.libraryTarget = 'umd';
    const [css] = helpers.getLoadersByName(config, 'css-loader');
    css.loader.options.modules = false;

    // Use any `index` file, not just index.ts
    config.resolve.alias['preact-cli-entrypoint'] = resolve(process.cwd(), 'src', 'index');

    config.output.filename = 'annotator-injector-outer-[name].js';
    const { plugin: cssExtractPlugin } = helpers.getPluginsByName(config, 'MiniCssExtractPlugin')[0];
    cssExtractPlugin.options.moduleFilename = () => 'annotator-injector-outer-styles.css';
    cssExtractPlugin.options.filename = 'annotator-injector-outer-styles.css';
  },
};
