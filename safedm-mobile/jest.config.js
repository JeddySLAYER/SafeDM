module.exports = {
  preset: "react-native",
  moduleFileExtensions: ["js", "jsx", "json", "ts", "tsx"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|react-native-safe-area-context|react-native-screens)/)",
  ],
};
