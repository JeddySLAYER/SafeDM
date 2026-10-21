/* eslint-env jest */

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ApiError } from "../../api/client";
import {
  acceptLegalDocuments,
  getLegalStatus,
  listLegalDocuments,
} from "../../api/legal";
import { useAuth } from "../../context/AuthContext";
import PoliciesScreen from "../PoliciesScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb) => {
    const React = require("react");
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === "function" ? cleanup : undefined;
    }, [cb]);
  },
}));

jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
}));

jest.mock("../../api/legal", () => ({
  getLegalStatus: jest.fn(),
  listLegalDocuments: jest.fn(),
  acceptLegalDocuments: jest.fn(),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const DOCS = [
  { slug: "privacy", title: "Politique de confidentialité", version: 1, body: "…" },
  { slug: "terms", title: "Conditions d'utilisation", version: 1, body: "…" },
];

const navigation = { reset: jest.fn(), navigate: jest.fn() };
const completePolicies = jest.fn(async () => {});
const trees = [];

function mockAuth({ authenticated }) {
  useAuth.mockReturnValue({
    completePolicies,
    needsSetup: false,
    isAuthenticated: authenticated,
  });
}

async function render() {
  let tree;
  await act(async () => {
    tree = renderer.create(
      React.createElement(PoliciesScreen, { navigation }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  trees.push(tree);
  return tree;
}

function pressByLabel(tree, label) {
  const node = tree.root.find((n) => n.props?.accessibilityLabel === label);
  return node.props.onPress();
}

function textsOf(tree) {
  return tree.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children);
}

beforeEach(() => {
  navigation.reset.mockClear();
  navigation.navigate.mockClear();
  completePolicies.mockClear();
  acceptLegalDocuments.mockClear();
  getLegalStatus.mockReset();
  listLegalDocuments.mockReset();
  getLegalStatus.mockResolvedValue({
    documents: DOCS,
    pending_slugs: ["privacy", "terms"],
  });
  listLegalDocuments.mockResolvedValue(DOCS);
});

afterEach(() => {
  while (trees.length) {
    const tree = trees.pop();
    act(() => {
      tree.unmount();
    });
  }
});

test("un invite accepte sans appel réseau", async () => {
  mockAuth({ authenticated: false });
  const tree = await render();

  expect(textsOf(tree)).toContain(
    "Sans compte, votre accord est enregistré sur ce téléphone uniquement. Il sera transmis à SafeDM si vous créez un compte plus tard.",
  );

  await act(async () => {
    await pressByLabel(tree, "J'accepte");
  });

  // Aucun appel au serveur : l'API exige un jeton.
  expect(acceptLegalDocuments).not.toHaveBeenCalled();
  expect(completePolicies).toHaveBeenCalledWith(DOCS);
  expect(navigation.reset).toHaveBeenCalled();
});

test("un utilisateur connecté enregistre l'acceptation côté serveur", async () => {
  mockAuth({ authenticated: true });
  acceptLegalDocuments.mockResolvedValue({});
  const tree = await render();

  await act(async () => {
    await pressByLabel(tree, "J'accepte");
  });

  expect(acceptLegalDocuments).toHaveBeenCalledWith([
    { slug: "privacy", version: 1 },
    { slug: "terms", version: 1 },
  ]);
  expect(navigation.reset).toHaveBeenCalled();
});

test("une session expirée propose de se reconnecter", async () => {
  mockAuth({ authenticated: true });
  acceptLegalDocuments.mockRejectedValue(
    new ApiError("Identifiants invalides ou token expiré", 401, "expired"),
  );
  const tree = await render();

  await act(async () => {
    await pressByLabel(tree, "J'accepte");
  });

  expect(textsOf(tree)).toContain(
    "Votre session a expiré. Reconnectez-vous pour enregistrer votre accord.",
  );
  expect(navigation.reset).not.toHaveBeenCalled();

  await act(async () => {
    pressByLabel(tree, "Se connecter");
  });
  expect(navigation.navigate).toHaveBeenCalledWith("Login");
});

test("une politique mise à jour est rechargée", async () => {
  mockAuth({ authenticated: true });
  acceptLegalDocuments.mockRejectedValue(
    new ApiError("Cette politique a été mise à jour", 409, "conflict"),
  );
  const tree = await render();

  await act(async () => {
    await pressByLabel(tree, "J'accepte");
  });

  expect(textsOf(tree)).toContain(
    "La politique a été mise à jour. Relisez-la puis acceptez-la à nouveau.",
  );
  expect(navigation.reset).not.toHaveBeenCalled();
});
