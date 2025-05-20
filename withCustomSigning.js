const { withXcodeProject } = require("expo/config-plugins");

/**
 * Config plugin to customize code signing for iOS
 * @param {Object} config - Expo config
 * @param {Object} props - Plugin properties
 * @param {string} props.codeSignStyle - "Manual" or "Automatic" 
 * @param {string} props.teamId - Developer Team ID
 * @param {string} props.provisioningProfileId - Provisioning Profile ID/Specifier 
 * @param {string} props.codeSignIdentity - Code Sign Identity (e.g., "iPhone Developer")
 * @returns {Object} Updated config
 */
const withCustomSigning = (config, props = {}) => {
  const { 
    codeSignStyle = "Manual", // Default to Manual if not specified
    teamId, 
    provisioningProfileId, 
    codeSignIdentity 
  } = props;
  
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    
    // Get all build configurations
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    // Update each build configuration with signing settings
    Object.keys(configurations).forEach((configKey) => {
      const buildConfig = configurations[configKey];
      
      if (buildConfig.buildSettings && typeof buildConfig.buildSettings === 'object') {
        // Set code signing style (Manual or Automatic)
        buildConfig.buildSettings.CODE_SIGN_STYLE = codeSignStyle;
        
        // Apply parameters if provided
        if (teamId) {
          buildConfig.buildSettings.DEVELOPMENT_TEAM = teamId;
        }
        
        // For Manual signing, set profile specifier if provided
        if (codeSignStyle === "Manual" && provisioningProfileId) {
          buildConfig.buildSettings.PROVISIONING_PROFILE_SPECIFIER = provisioningProfileId;
        }
        
        if (codeSignIdentity) {
          buildConfig.buildSettings.CODE_SIGN_IDENTITY = codeSignIdentity;
        }
      }
    });
    
    return config;
  });
};

module.exports = withCustomSigning;