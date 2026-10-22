/* eslint-env jest */

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ApiError } from "../../api/client";
import { listMyReports } from "../../api/reports";
import { useAuth } from "../../context/AuthContext";
import ReportsScreen from "../ReportsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb) => {
    const React = require("react");
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === "function" ? cleanup : undefined;
    }, [cb]);
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
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

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
}));

jest.mock("../../api/reports", () => ({
  listMyReports: jest.fn(),
  withdrawReport: jest.fn(),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const trees = [];

function mockAuth(authenticated) {
  useAuth.mockReturnValue({ isAuthenticated: authenticated });
}

async function render() {
  let tree;
  await act(async () => {
    tree = renderer.create(React.createElement(ReportsScreen));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  trees.push(tree);
  return tree;
}

function textsOf(tree) {
  return tree.root
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children);
}

function buttonLabels(tree) {
  return tree.root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string")
    .map((n) => n.props.accessibilityLabel);
}

beforeEach(() => {
  listMyReports.mockReset();
  useAuth.mockReset();
});

afterEach(() => {
  while (trees.length) {
    const tree = trees.pop();
    act(() => {
      tree.unmount();
    });
  }
});

test("un visiteur est invite a se connecter, sans impasse", async () => {
  mockAuth(false);
  listMyReports.mockRejectedValue(
    new ApiError("Connectez-vous pour utiliser cette fonction.", 401, null, true),
  );

  const tree = await render();

  expect(textsOf(tree)).toContain("Vos signalements");
  expect(buttonLabels(tree)).toEqual(
    expect.arrayContaining(["Créer un compte", "J'ai déjà un compte"]),
  );
  // Aucune impasse : pas de message « session expirée ».
  expect(textsOf(tree).join(" ")).not.toMatch(/session a expir/i);
});

test("une session refusée par le serveur bascule sur l'invitation", async () => {
  mockAuth(true);
  listMyReports.mockRejectedValue(
    new ApiError("Votre session a expiré. Reconnectez-vous.", 401, null, true),
  );

  const tree = await render();

  expect(buttonLabels(tree)).toEqual(
    expect.arrayContaining(["Se connecter", "Créer un compte"]),
  );
  expect(textsOf(tree).join(" ")).not.toMatch(/session a expir/i);
});

test("un utilisateur connecté voit ses signalements", async () => {
  mockAuth(true);
  listMyReports.mockResolvedValue({
    items: [
      {
        id: "r1",
        created_at: "2026-01-01T10:00:00Z",
        severity: "HIGH",
        threat_preview: "Votre compte sera bloqué",
        report_count: 3,
      },
    ],
  });

  const tree = await render();

  expect(textsOf(tree)).toContain("Votre compte sera bloqué");
  expect(buttonLabels(tree)).not.toContain("Créer un compte");
});
