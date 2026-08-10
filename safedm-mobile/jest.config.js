module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@react-native-async-storage/.*|react-native-safe-area-context|react-native-screens)",
  ],
  moduleNameMapper: {
    "^expo-constants$": "<rootDir>/__mocks__/expo-constants.js",
  },
};
