/* eslint-env jest */

import React from "react";
import renderer, { act } from "react-test-renderer";
import * as authApi from "../../api/auth";
import { acceptLegalDocuments, getLegalStatus } from "../../api/legal";
import { AuthProvider, useAuth } from "../AuthContext";
import * as storage from "../../utils/storage";

jest.mock("../../api/legal", () => ({
  getLegalStatus: jest.fn(),
  acceptLegalDocuments: jest.fn(),
}));

jest.mock("../../api/auth", () => ({
  login: jest.fn(),
  register: jest.fn(),
  loginWithFirebaseToken: jest.fn(),
}));

jest.mock("../../api/users", () => ({
  getMe: jest.fn(),
  registerDevice: jest.fn(async () => {}),
}));

jest.mock("../../services/firebaseAuth", () => ({
  signInWithFirebase: jest.fn(),
}));

jest.mock("../../utils/storage", () => ({
  getToken: jest.fn(async () => null),
  getStoredUser: jest.fn(async () => null),
  setToken: jest.fn(async () => {}),
  setStoredUser: jest.fn(async () => {}),
  clearSession: jest.fn(async () => {}),
  isOnboardingDone: jest.fn(async () => true),
  isSetupDone: jest.fn(async () => true),
  getOrCreateDeviceId: jest.fn(async () => "device-1"),
  getAcceptedPolicies: jest.fn(async () => ({})),
  setAcceptedPolicies: jest.fn(async () => {}),
  setOnboardingDone: jest.fn(async () => {}),
  setSetupDone: jest.fn(async () => {}),
}));

const DOCS = [
  { slug: "privacy", title: "Politique de confidentialité", version: 1, body: "…" },
  { slug: "terms", title: "Conditions d'utilisation", version: 1, body: "…" },
];

let ctx = null;
const trees = [];

function Probe() {
  ctx = useAuth();
  return null;
}

async function render() {
  let tree;
  await act(async () => {
    tree = renderer.create(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(Probe),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  trees.push(tree);
  return tree;
}

beforeEach(() => {
  ctx = null;
  storage.getToken.mockResolvedValue(null);
  storage.getAcceptedPolicies.mockResolvedValue({});
  getLegalStatus.mockReset();
  acceptLegalDocuments.mockReset();
  acceptLegalDocuments.mockResolvedValue({});
  authApi.login.mockResolvedValue({
    access_token: "token-1",
    user: { id: 1, username: "joan", is_admin: false },
  });
});

afterEach(() => {
  while (trees.length) {
    const tree = trees.pop();
    act(() => {
      tree.unmount();
    });
  }
  jest.clearAllMocks();
});

test("un invité qui a déjà accepté localement n'est pas bloqué", async () => {
  storage.getAcceptedPolicies.mockResolvedValue({ privacy: 1, terms: 1 });
  await render();
  expect(ctx.policiesOk).toBe(true);
  expect(ctx.isAuthenticated).toBe(false);
});

test("un invité sans accord local est bloqué", async () => {
  await render();
  expect(ctx.policiesOk).toBe(false);
});

test("l'acceptation hors ligne est rejouée sur le compte", async () => {
  storage.getAcceptedPolicies.mockResolvedValue({ privacy: 1, terms: 1 });
  getLegalStatus
    .mockResolvedValueOnce({
      documents: DOCS,
      pending_slugs: ["privacy", "terms"],
    })
    .mockResolvedValueOnce({
      documents: DOCS,
      pending_slugs: [],
    });
  await render();

  await act(async () => {
    await ctx.login("joan", "motdepasse");
  });

  expect(acceptLegalDocuments).toHaveBeenCalledWith([
    { slug: "privacy", version: 1 },
    { slug: "terms", version: 1 },
  ]);
  expect(ctx.policiesOk).toBe(true);
});

test("une politique plus recente n'est pas acceptee en silence", async () => {
  storage.getAcceptedPolicies.mockResolvedValue({ privacy: 1, terms: 1 });
  getLegalStatus
    .mockResolvedValueOnce({
      documents: [
        { slug: "privacy", title: "Politique de confidentialité", version: 2, body: "…" },
        { slug: "terms", title: "Conditions d'utilisation", version: 1, body: "…" },
      ],
      pending_slugs: ["privacy", "terms"],
    })
    .mockResolvedValueOnce({
      documents: [
        { slug: "privacy", title: "Politique de confidentialité", version: 2, body: "…" },
        { slug: "terms", title: "Conditions d'utilisation", version: 1, body: "…" },
      ],
      pending_slugs: ["privacy"],
    });
  await render();

  await act(async () => {
    await ctx.login("joan", "motdepasse");
  });

  // Seule la version inchangee est rejouee ; l'utilisateur doit relire la
  // politique mise a jour.
  expect(acceptLegalDocuments).toHaveBeenCalledWith([
    { slug: "terms", version: 1 },
  ]);
  expect(ctx.policiesOk).toBe(false);
});

test("completePolicies memorise les versions acceptees", async () => {
  await render();
  await act(async () => {
    await ctx.completePolicies(DOCS);
  });
  expect(storage.setAcceptedPolicies).toHaveBeenCalledWith({
    privacy: 1,
    terms: 1,
  });
  expect(ctx.policiesOk).toBe(true);
});
