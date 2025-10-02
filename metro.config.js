const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore Hermes InternalBytecode frames to avoid ENOENT on InternalBytecode.js during symbolication
// See: https://github.com/expo/expo/pull/20432
config.symbolicator = {
  customizeFrame: (frame) => {
    if (frame.file && frame.file.includes('InternalBytecode.js')) {
      return null; // Skip these frames
    }
    return frame;
  },
};

module.exports = config;
