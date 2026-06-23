const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix tslib resolution for pdf-lib
// pdf-lib bundles its own tslib which breaks with Metro's module resolution
// Force all tslib imports to use the root-level tslib instead
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    tslib: path.resolve(__dirname, 'node_modules/tslib'),
  },
};

module.exports = config;