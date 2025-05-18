const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

function addImport(content) {
    // Split the file into lines
    const lines = content.split('\n');
    // Find indices of all import lines
    const importIndices = lines
      .map((line, idx) => (line.trim().startsWith('import ') ? idx : -1))
      .filter(idx => idx !== -1);
  
    // If import CodePush already exists, return as is
    if (content.includes('import CodePush')) {
      return content;
    }
  
    if (importIndices.length > 0) {
      // Insert after the last import
      const lastImportIdx = importIndices[importIndices.length - 1];
      lines.splice(lastImportIdx + 1, 0, 'import CodePush');
      return lines.join('\n');
    } else {
      // No import lines, add at the top
      return 'import CodePush\n' + content;
    }
  }

function replaceBundleURL(content) {
  // Replace production bundle URL with CodePush.bundleURL()
  const prodRegex = /Bundle\.main\.url\(forResource: "main", withExtension: "jsbundle"\)/g;
  if (prodRegex.test(content)) {
    return content.replace(prodRegex, 'CodePush.bundleURL()');
  }
  return content;
}

function ensureBundleURLMethod(content) {
  // Check if bundleURL() method exists, and patch it if needed
  const methodRegex = /override func bundleURL\(\) -> URL\? \{[^}]*\}/s;
  if (methodRegex.test(content)) {
    // Replace the method body
    return content.replace(
      methodRegex,
      `override func bundleURL() -> URL? {
#if DEBUG
  return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
  return CodePush.bundleURL()
#endif
}`
    );
  } else {
    // Insert the method before the last }
    const insertAt = content.lastIndexOf('}');
    if (insertAt !== -1) {
      return (
        content.slice(0, insertAt) +
        `
  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return CodePush.bundleURL()
#endif
  }
` +
        content.slice(insertAt)
      );
    }
  }
  return content;
}

const withCodePushAppDelegate = (config) => {
  return withAppDelegate(config, (config) => {
    let content = config.modResults.contents;
    content = addImport(content);
    content = replaceBundleURL(content);
    content = ensureBundleURLMethod(content);
    config.modResults.contents = content;
    return config;
  });
};

// Add Info.plist modification
const withCodePushInfoPlist = (config, options = {}) => {
    return withInfoPlist(config, (config) => {
        if (options.ios && options.ios.CodePushDeploymentKey) {
            config.modResults.CodePushDeploymentKey = options.ios.CodePushDeploymentKey;
        }
        if (options.ios && options.ios.CodePushServerURL) {
            config.modResults.CodePushServerURL = options.ios.CodePushServerURL;
        }
        return config;
    });
};

module.exports = (config, options = {}) => {
  config = withCodePushAppDelegate(config, options);
  config = withCodePushInfoPlist(config, options);
  return config;
};
