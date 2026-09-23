const { withXcodeProject } = require("expo/config-plugins");

/**
 * Disables Xcode's user script sandboxing. React Native's
 * "Bundle React Native code and images" build phase (react-native-xcode.sh)
 * writes `ip.txt` into the app bundle, which the default
 * `ENABLE_USER_SCRIPT_SANDBOXING = YES` (Xcode 15+) blocks.
 */
module.exports = function withDisableUserScriptSandboxing(config) {
  return withXcodeProject(config, (config) => {
    config.modResults.updateBuildProperty(
      "ENABLE_USER_SCRIPT_SANDBOXING",
      "NO"
    );
    return config;
  });
};
