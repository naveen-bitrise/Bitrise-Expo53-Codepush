// app.config.js

// Import dotenv to load environment variables from .env file
// Make sure to call config() at the very beginning
require('dotenv').config();

// Retrieve CodePush keys from environment variables
// It's good practice to provide fallbacks or throw an error if they are not set,
// depending on whether these keys are absolutely mandatory for all build types.
const IOS_CODEPUSH_DEPLOYMENT_KEY = process.env.IOS_CODEPUSH_DEPLOYMENT_KEY;
const ANDROID_CODEPUSH_DEPLOYMENT_KEY = process.env.ANDROID_CODEPUSH_DEPLOYMENT_KEY;

// You can add checks here to ensure the environment variables are loaded
if (!IOS_CODEPUSH_DEPLOYMENT_KEY) {
  console.warn("Warning: IOS_CODEPUSH_DEPLOYMENT_KEY is not set in your .env file. CodePush for iOS might not work correctly.");
  // Or throw an error if it's critical for your build:
  // throw new Error("Missing environment variable: IOS_CODEPUSH_DEPLOYMENT_KEY");
}

if (!ANDROID_CODEPUSH_DEPLOYMENT_KEY) {
  console.warn("Warning: ANDROID_CODEPUSH_DEPLOYMENT_KEY is not set in your .env file. CodePush for Android might not work correctly.");
  // Or throw an error:
  // throw new Error("Missing environment variable: ANDROID_CODEPUSH_DEPLOYMENT_KEY");
}

export default ({ config }) => {
  // The 'config' argument in the function is the static app.json
  // You can spread it and override or add properties dynamically.
  // For this conversion, we are essentially rebuilding it in JS format.

  return {
    // Spread the existing static config from app.json if you were migrating
    // from an app.json that was passed to the function.
    // For a direct conversion, we define all properties here.
    // ...config, // This would be used if you had a base app.json and wanted to modify it

    expo: {
      name: "Bitrise-Expo53-Codepush",
      slug: "Bitrise-Expo53-Codepush",
      version: "1.2.0", // You might want to manage this dynamically or keep it static
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      newArchEnabled: true, // Corresponds to newArchEnabled in app.json
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.anonymous.BitriseExpo53Codepush"
        // You can add more iOS specific configurations here if needed
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff"
        },
        edgeToEdgeEnabled: true, // Corresponds to edgeToEdgeEnabled in app.json
        package: "com.anonymous.BitriseExpo53Codepush"
        // You can add more Android specific configurations here if needed
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      plugins: [
        [
        "./codepush-plugin.js", // Path to your custom CodePush plugin
          {
            ios: {
                // Use the environment variable for the iOS CodePush Deployment Key
                CodePushDeploymentKey: IOS_CODEPUSH_DEPLOYMENT_KEY || "YOUR_IOS_FALLBACK_KEY_IF_ANY", // Fallback is optional
                CodePushServerURL: "https://codepush.bitrise.io" 
            },
            android: {
                // Use the environment variable for the Android CodePush Deployment Key
                CodePushDeploymentKey: ANDROID_CODEPUSH_DEPLOYMENT_KEY || "YOUR_ANDROID_FALLBACK_KEY_IF_ANY", // Fallback is optional
                CodePushServerURL: "https://codepush.bitrise.io" 
            }
          }
        ],
        [
          "expo-build-properties",
          {
            ios: {
              deploymentTarget: "15.5"
            }

          }
        ]
        // Add other plugins here if you have more
      ]
    }
  };
};
