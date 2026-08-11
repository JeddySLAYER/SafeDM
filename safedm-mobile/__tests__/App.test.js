/**
 * @format
 */

import React, { act } from "react";
import { it } from "@jest/globals";
import renderer from "react-test-renderer";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({ children }) => children,
  createNavigationContainerRef: () => ({
    isReady: () => false,
    navigate: jest.fn(),
    current: null,
  }),
  useFocusEffect: (cb) => {
    const React = require("react");
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === "function" ? cleanup : undefined;
    }, [cb]);
  },
}));

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: () => null,
  }),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: () => null,
  }),
}));

jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn(async () => ""),
  setStringAsync: jest.fn(async () => {}),
}));

jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  parse: jest.fn(() => ({})),
  createURL: jest.fn((path) => `safedm://${path}`),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = (props) => React.createElement(View, props);
  return new Proxy(
    {},
    {
      get: () => Icon,
    },
  );
});

jest.mock("../src/services/notificationBridge", () => ({
  isNotificationAccessEnabled: jest.fn(async () => false),
  openNotificationListenerSettings: jest.fn(),
  syncMonitoredPackages: jest.fn(async () => {}),
  getEnabledPackageNames: jest.fn(async () => []),
  subscribeToNotifications: jest.fn(() => ({ remove: jest.fn() })),
  flushPendingNotifications: jest.fn(async () => []),
  listInstalledApps: jest.fn(async () => []),
  expandMonitoredPackages: jest.fn((pkgs) => pkgs || []),
  getLaunchUrl: jest.fn(async () => null),
  isDefaultBrowser: jest.fn(async () => false),
  requestDefaultBrowserRole: jest.fn(async () => false),
  openDefaultAppsSettings: jest.fn(),
  openUrlExternally: jest.fn(async () => true),
  subscribeToLinkIntents: jest.fn(() => ({ remove: jest.fn() })),
}));

import App from "../App";

it("renders correctly", async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<App />);
    await Promise.resolve();
  });
  expect(tree).toBeTruthy();
  await act(async () => {
    tree.unmount();
  });
}, 15000);
