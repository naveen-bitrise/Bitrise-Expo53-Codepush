const {
  withAppDelegate,
  withInfoPlist,
  withStringsXml,
  withAppBuildGradle,
  withDangerousMod,
  WarningAggregator, // For logging warnings if patterns aren't found
} = require('@expo/config-plugins');
const fs = require('fs'); // For synchronous file operations if needed, or use async from config.modRequest.fs
const path = require('path'); // For path operations

//================ iOS (Original - Unchanged) ================
function addImportIOS(content) {
  const lines = content.split('\n');
  const importIndices = lines
    .map((line, idx) => (line.trim().startsWith('import ') || line.trim().startsWith('#import ') ? idx : -1))
    .filter(idx => idx !== -1);

  if (content.includes('import CodePush') || content.includes('#import <CodePush/CodePush.h>')) {
    return content;
  }

  const codePushImport = '#import <CodePush/CodePush.h>';

  if (importIndices.length > 0) {
    const lastImportIdx = importIndices[importIndices.length - 1];
    lines.splice(lastImportIdx + 1, 0, codePushImport);
    return lines.join('\n');
  } else {
    return codePushImport + '\n' + content;
  }
}

function ensureBundleURLMethodIOS(content) {
  const methodRegex = /override func bundleURL\(\) -> URL\? \{[^}]*\}/s;
  const newMethodBody = `override func bundleURL() -> URL? {
#if DEBUG
  return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
  return CodePush.bundleURL()
#endif
}`;

  if (methodRegex.test(content)) {
    return content.replace(methodRegex, newMethodBody);
  } else {
    const appDelegateEndRegex = /@end/gm;
    if (appDelegateEndRegex.test(content)) {
        return content.replace(appDelegateEndRegex, `\n${newMethodBody}\n\n@end`);
    }
    const lastBrace = content.lastIndexOf('}');
    if (lastBrace !== -1) {
      return (
        content.slice(0, lastBrace) +
        `\n  ${newMethodBody}\n` +
        content.slice(lastBrace)
      );
    }
  }
  WarningAggregator.addWarningIOS('codepush-plugin', 'Could not find a suitable place to insert bundleURL() method in AppDelegate.');
  return content;
}

const withCodePushAppDelegate = (config) => {
  return withAppDelegate(config, (config) => {
    let content = config.modResults.contents;
    content = addImportIOS(content);
    // The original plugin had replaceBundleURL, which is less robust than ensureBundleURLMethod
    // ensureBundleURLMethod handles both replacing and adding.
    content = ensureBundleURLMethodIOS(content);
    config.modResults.contents = content;
    return config;
  });
};

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

//================ Android (Modified) ================

// Helper to add imports to MainApplication.kt if they don't exist
function addKotlinImports(content, importsToAdd) {
  const lines = content.split('\n');
  let lastImportIndex = -1;
  const existingImports = new Set();

  lines.forEach((line, index) => {
    if (line.trim().startsWith('import ')) {
      lastImportIndex = index;
      existingImports.add(line.trim());
    }
  });

  // Filter out imports that already exist
  const newImports = importsToAdd.filter(imp => !existingImports.has(imp));

  if (newImports.length > 0) {
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, ...newImports);
    } else {
      // No imports found, add at the top after package declaration (if any)
      const packageIndex = lines.findIndex(line => line.trim().startsWith('package '));
      if (packageIndex !== -1) {
        lines.splice(packageIndex + 1, 0, '', ...newImports); // Add a blank line for separation
      } else {
        lines.unshift(...newImports);
      }
    }
  }
  return lines.join('\n');
}


const withAndroidMainApplication = (config) => {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const packageName = modConfig.android.package;
      if (!packageName) {
        throw new Error('[codepush-plugin] android.package not defined in app config');
      }

      const packagePath = packageName.replace(/\./g, '/');
      const mainAppPath = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', packagePath, 'MainApplication.kt');
      
      if (!fs.existsSync(mainAppPath)) {
        throw new Error(
          `[codepush-plugin] MainApplication.kt not found at ${mainAppPath}\n` +
          'Make sure you have run "npx expo prebuild" first'
        );
      }

      let content = fs.readFileSync(mainAppPath, 'utf-8');

      // Ensure necessary imports
      const requiredImports = [
        'import com.microsoft.codepush.react.CodePush',
        `import ${packageName}.R`, // For R.string.CodePushDeploymentKey
        'import android.util.Log',   // For Log.d/e
        // BuildConfig should be available if buildConfigFields are set
      ];
      content = addKotlinImports(content, requiredImports);
      
      // --- Modify onCreate method ---
      const onCreateRegex = /(override fun onCreate\(\) \{)/gm;
      const onCreateInjection = `
    super.onCreate() // Ensure super is called first
    // SoLoader.init should be called before CodePush init
    // Assuming SoLoader.init is already present or handled by Expo's default MainApplication.kt template

    try {
        Log.d("CodePushDebug", "Attempting to pre-initialize CodePush in onCreate...");
        val deploymentKey = getString(R.string.CodePushDeploymentKey);
        val isDebugMode = BuildConfig.DEBUG; // This will be available due to build.gradle changes
        CodePush.getInstance(deploymentKey, this, isDebugMode);
        Log.d("CodePushDebug", "CodePush.getInstance() called in onCreate()");
    } catch (e: Exception) {
        Log.e("CodePushDebug", "Error pre-initializing CodePush in onCreate: " + e.message, e);
    }
    // The rest of the original onCreate method continues after this block
`;
      if (onCreateRegex.test(content)) {
        // Try to inject after SoLoader.init if present, otherwise after super.onCreate()
        const soLoaderInitPattern = /SoLoader\.init\(this,.*\)/m;
        const superOnCreatePattern = /super\.onCreate\(\)/m;

        if (soLoaderInitPattern.test(content)) {
            content = content.replace(soLoaderInitPattern, `$&${onCreateInjection}`);
        } else if (superOnCreatePattern.test(content)) {
            content = content.replace(superOnCreatePattern, `$&${onCreateInjection}`);
        } else {
            // Fallback: inject directly after the onCreate signature
            content = content.replace(onCreateRegex, `$1${onCreateInjection}`);
            WarningAggregator.addWarningAndroid('codepush-plugin', 'Could not reliably find SoLoader.init() or super.onCreate() in MainApplication.kt onCreate(). CodePush pre-initialization might be misplaced.');
        }
      } else {
        WarningAggregator.addWarningAndroid('codepush-plugin', 'onCreate() method not found in MainApplication.kt. CodePush pre-initialization skipped.');
      }

      // --- Modify getPackages method ---
      const getPackagesRegex = /(override fun getPackages\(\): List<ReactPackage> \{)/gm;
      const getPackagesReturnRegex = /return\s+packages/gm;
      const packagesInitializationRegex = /val\s+packages:\s*MutableList<ReactPackage>\s*=\s*PackageList\(this\)\.getPackages\(\)\.toMutableList\(\)/m;


      const packagesInjection = `
        try {
            Log.d("CodePushDebug", "Attempting to add CodePush to packages in getPackages()...");
            val deploymentKey = getString(R.string.CodePushDeploymentKey);
            val isDebugMode = BuildConfig.DEBUG; // Assumes BuildConfig.DEBUG is available
            val codePushInstance = CodePush.getInstance(deploymentKey, this@MainApplication, isDebugMode);
            // Check if already added by PackageList (unlikely for manual setup but safe)
            var alreadyAdded = false;
            for (pkg in packages) {
                if (pkg.javaClass.name == codePushInstance.javaClass.name) {
                    alreadyAdded = true;
                    break;
                }
            }
            if (!alreadyAdded) {
                packages.add(codePushInstance);
                Log.d("CodePushDebug", "CodePush instance added to packages.");
            } else {
                Log.d("CodePushDebug", "CodePush instance was already present in packages list.");
            }
        } catch (e: Exception) {
            Log.e("CodePushDebug", "Error adding CodePush to packages in getPackages: " + e.message, e);
        }
`;
      if (getPackagesRegex.test(content)) {
        if (packagesInitializationRegex.test(content)) {
            // Inject after the packages list is initialized
            content = content.replace(packagesInitializationRegex, `$&${packagesInjection}`);
        } else if (getPackagesReturnRegex.test(content)) {
            // Fallback: Inject before the return statement
            content = content.replace(getPackagesReturnRegex, `${packagesInjection}\n        return packages`);
             WarningAggregator.addWarningAndroid('codepush-plugin', 'Could not find standard packages list initialization in getPackages(). CodePush package injection might be misplaced.');
        } else {
            WarningAggregator.addWarningAndroid('codepush-plugin', 'Could not find return statement in getPackages() in MainApplication.kt. CodePush package registration skipped.');
        }
      } else {
        WarningAggregator.addWarningAndroid('codepush-plugin', 'getPackages() method not found in MainApplication.kt. CodePush package registration skipped.');
      }
      
      // --- Add getJSBundleFile method (original logic, ensuring it's placed correctly) ---
      const getJSBundleFileMethod = `
    override fun getJSBundleFile(): String {
        return CodePush.getJSBundleFile()
    }`;

      if (!content.includes("override fun getJSBundleFile(): String")) {
        // Try to add it after getPackages() or before the class end `}`
        const classEndRegex = /\n}\s*$/gm; // Matches the last closing brace of the class
        const getPackagesEndRegex = /(override fun getPackages\(\): List<ReactPackage> \{[^}]*\})\s*\n/gm;

        if (getPackagesEndRegex.test(content)) {
            content = content.replace(getPackagesEndRegex, `$1\n${getJSBundleFileMethod}\n`);
        } else if (classEndRegex.test(content)) {
            content = content.replace(classEndRegex, `\n${getJSBundleFileMethod}\n}\n`);
        } else {
            WarningAggregator.addWarningAndroid('codepush-plugin', 'Could not find a suitable place to insert getJSBundleFile() method in MainApplication.kt.');
        }
      }

      fs.writeFileSync(mainAppPath, content);
      return modConfig;
    }
  ]);
};


const withAndroidGradle = (config) => {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      let content = modConfig.modResults.contents;

      // 1. Add codepush.gradle apply line (original logic)
      const codePushApplyLine = 'apply from: "../../node_modules/@code-push-next/react-native-code-push/android/codepush.gradle"';
      if (!content.includes(codePushApplyLine)) {
        content += `\n${codePushApplyLine}\n`;
      }

      // 2. Add buildConfigField "boolean", "DEBUG" to debug and release types
      const buildTypesRegex = /android\s*\{\s*[^}]*buildTypes\s*\{([\s\S]*?)\n\s*\}/m;
      const buildTypesMatch = content.match(buildTypesRegex);

      if (buildTypesMatch) {
        let buildTypesContent = buildTypesMatch[1];
        const debugBlockRegex = /debug\s*\{([\s\S]*?)\n\s*\}/m;
        const releaseBlockRegex = /release\s*\{([\s\S]*?)\n\s*\}/m;
        const debugConfigField = 'buildConfigField "boolean", "DEBUG", "true"';
        const releaseConfigField = 'buildConfigField "boolean", "DEBUG", "false"';

        // Modify debug block
        if (debugBlockRegex.test(buildTypesContent)) {
          if (!buildTypesContent.match(debugBlockRegex)[0].includes(debugConfigField)) {
            buildTypesContent = buildTypesContent.replace(debugBlockRegex, (match, group1) => {
              return `debug {\n            ${group1.trim()}\n            ${debugConfigField}\n        }`;
            });
          }
        } else {
          buildTypesContent += `\n        debug {\n            ${debugConfigField}\n        }`;
        }

        // Modify release block
        if (releaseBlockRegex.test(buildTypesContent)) {
           if (!buildTypesContent.match(releaseBlockRegex)[0].includes(releaseConfigField)) {
            buildTypesContent = buildTypesContent.replace(releaseBlockRegex, (match, group1) => {
              return `release {\n            ${group1.trim()}\n            ${releaseConfigField}\n        }`;
            });
          }
        } else {
          buildTypesContent += `\n        release {\n            ${releaseConfigField}\n        }`;
        }
        content = content.replace(buildTypesRegex, `android {\n    buildTypes {\n${buildTypesContent}\n    }\n}`);
      } else {
        WarningAggregator.addWarningAndroid('codepush-plugin', 'Could not find buildTypes block in app/build.gradle to add DEBUG buildConfigField.');
      }
      
      // 3. Set react.bundleAssetName = "main.jsbundle"
      const reactBlockRegex = /react\s*\{([\s\S]*?)\n\}/m; // Matches existing react block
      const bundleAssetNameLine = 'bundleAssetName = "main.jsbundle"';

      if (reactBlockRegex.test(content)) {
        content = content.replace(reactBlockRegex, (match, group1) => {
          if (group1.includes('bundleAssetName')) {
            // Replace existing bundleAssetName
            return match.replace(/bundleAssetName\s*=\s*["'].*["']/, bundleAssetNameLine);
          } else {
            // Add new bundleAssetName
            return `react {\n    ${group1.trim()}\n    ${bundleAssetNameLine}\n}`;
          }
        });
      } else {
        // If react block doesn't exist, this is more complex as its structure is specific.
        // For now, we'll warn. A more robust plugin might create it.
        // However, user confirmed it exists from Expo prebuild.
        WarningAggregator.addWarningAndroid('codepush-plugin', 'Could not find react { ... } block in app/build.gradle to set bundleAssetName. This is usually created by "npx expo prebuild".');
      }

      modConfig.modResults.contents = content;
    } else {
      WarningAggregator.addWarningAndroid('codepush-plugin', 'app/build.gradle is not groovy. Android modifications skipped.');
    }
    return modConfig;
  });
};


const withAndroidStrings = (config, options) => {
  return withStringsXml(config, (config) => {
    // Ensure resources and string array exist
    if (!config.modResults.resources) {
      config.modResults.resources = {};
    }
    if (!config.modResults.resources.string) {
      config.modResults.resources.string = [];
    }

    const strings = config.modResults.resources.string;

    // Add CodePushDeploymentKey to strings.xml
    if (options.android && options.android.CodePushDeploymentKey) {
      const existingKey = strings.find(s => s.$.name === 'CodePushDeploymentKey');
      if (existingKey) {
        existingKey._ = options.android.CodePushDeploymentKey; // Update if exists
      } else {
        strings.push({
          $: { name: 'CodePushDeploymentKey', translatable: 'false' }, // Added translatable=false as it's a key
          _: options.android.CodePushDeploymentKey,
        });
      }
    }

    // Add CodePushServerURL to strings.xml
    if (options.android && options.android.CodePushServerURL) {
      const existingUrl = strings.find(s => s.$.name === 'CodePushServerURL');
      if (existingUrl) {
        existingUrl._ = options.android.CodePushServerURL; // Update if exists
      } else {
        strings.push({
          $: { name: 'CodePushServerURL', translatable: 'false' }, // Added translatable=false
          _: options.android.CodePushServerURL,
        });
      }
    }
    return config;
  });
};


module.exports = (config, options = {}) => {
  if (!options) options = {}; // Ensure options is an object

  if (options.ios) {
    config = withCodePushAppDelegate(config, options);
    config = withCodePushInfoPlist(config, options);
  }

  if (options.android) {
    config = withAndroidStrings(config, options); // Strings first, as MainApplication might need them
    config = withAndroidMainApplication(config); // MainApplication before build.gradle in case it needs BuildConfig
    config = withAndroidGradle(config);      // build.gradle last to set up buildConfigFields
  }
  return config;
};
