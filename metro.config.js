const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.sourceExts = ["jsx", "js", "ts", "tsx", "json", "mjs", "cjs"];
config.resolver.assetExts = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "db",
];

// Add resolution for problematic packages
config.resolver.extraNodeModules = {
  // Force resolution of idb to a working version
  idb: require.resolve("idb"),
};

// Add additional configuration for ES modules
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});

// Handle problematic Firebase packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle idb resolution specifically
  if (moduleName.includes("idb") && !moduleName.endsWith(".js")) {
    try {
      return {
        filePath: require.resolve("idb"),
        type: "sourceFile",
      };
    } catch (e) {
      // Fall back to default resolver
    }
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
