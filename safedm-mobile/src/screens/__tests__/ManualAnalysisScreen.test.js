/* eslint-env jest */

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { analyzePastedText } from "../../services/messageAnalysis";
import ManualAnalysisScreen from "../ManualAnalysisScreen";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn(async () => ""),
}));

// lucide-react-native est publié en ESM : on le remplace par un stub.
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = (props) => React.createElement(View, props);
  return new Proxy({ __esModule: true }, { get: () => Icon });
});

jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../services/messageAnalysis", () => ({
  analyzePastedText: jest.fn(),
}));

jest.mock("../../services/alertsStore", () => ({
  addAlertFromManualAnalysis: jest.fn(async () => {}),
}));

const trees = [];

function navigation() {
  return { navigate: jest.fn(), goBack: jest.fn() };
}

async function render(props = {}) {
  let tree;
  await act(async () => {
    tree = renderer.create(
      React.createElement(ManualAnalysisScreen, {
        navigation: navigation(),
        route: { params: { initialContent: "un message franchement suspect" } },
        ...props,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  trees.push(tree);
  return tree;
}

function buttonLabels(tree) {
  return tree.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string")
    .map((n) => n.props.accessibilityLabel);
}

function textsOf(tree) {
  return tree.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children);
}

async function press(tree, label) {
  const node = tree.root
    .findAll((n) => n.props?.accessibilityLabel === label)
    .find((n) => typeof n.props?.onPress === "function");
  await act(async () => {
    node.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  analyzePastedText.mockReset();
  useAuth.mockReset();
  useAuth.mockReturnValue({ isAuthenticated: false });
});

afterEach(() => {
  while (trees.length) {
    const tree = trees.pop();
    act(() => {
      tree.unmount();
    });
  }
});

test("le bouton Analyser reste disponible pour un visiteur", async () => {
  analyzePastedText.mockResolvedValue({ result: { status: "SAFE" } });

  const tree = await render();

  expect(buttonLabels(tree)).toContain("Analyser");
});

test("une vérification qui exige un compte remplace le bouton par l'invitation", async () => {
  analyzePastedText.mockResolvedValue({ requiresAuth: true });

  const tree = await render();
  await press(tree, "Analyser");

  expect(buttonLabels(tree)).not.toContain("Analyser");
  expect(buttonLabels(tree)).toEqual(
    expect.arrayContaining(["Créer un compte", "J'ai déjà un compte"]),
  );
  expect(textsOf(tree).join(" ")).not.toMatch(/session a expir/i);
});

test("une session déjà créée propose d'abord la connexion", async () => {
  useAuth.mockReturnValue({ isAuthenticated: true });
  analyzePastedText.mockResolvedValue({
    requiresAuth: true,
    cause: new ApiError("Votre session a expiré.", 401, null, true),
  });

  const tree = await render();
  await press(tree, "Analyser");

  expect(buttonLabels(tree)).toEqual(
    expect.arrayContaining(["Se connecter", "Créer un compte"]),
  );
});
