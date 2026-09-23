const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Removes the `aps-environment` entitlement that `expo-notifications` adds
 * automatically (via prebuild's versioned SDK plugins). This app only uses the
 * local badge API (`setBadgeCountAsync`), not remote push, and the Push
 * Notifications capability requires a paid Apple Developer account (free
 * "Personal Teams" cannot provision it).
 */
module.exports = function withRemoveApsEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};
