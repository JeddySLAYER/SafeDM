/* eslint-env jest */

import React from "react";
import { Pressable, Share } from "react-native";
import renderer, { act } from "react-test-renderer";
import * as Clipboard from "expo-clipboard";
import LinkActions from "../LinkActions";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ""),
}));

// lucide-react-native est publié en ESM : on le remplace par un stub pour
// ne tester que le comportement de LinkActions.
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = (props) => React.createElement(View, props);
  return new Proxy({ __esModule: true }, { get: () => Icon });
});

const URL = "https://exemple.test/lien?a=1";
const trees = [];

function render(url = URL) {
  let tree;
  act(() => {
    tree = renderer.create(React.createElement(LinkActions, { url }));
  });
  trees.push(tree);
  return tree;
}

function pressByLabel(tree, label) {
  const node = tree.root.find((n) => n.props?.accessibilityLabel === label);
  act(() => {
    node.props.onPress();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  while (trees.length) {
    const tree = trees.pop();
    act(() => {
      tree.unmount();
    });
  }
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

test("affiche les deux actions sur le lien", () => {
  const tree = render();
  const labels = tree.root
    .findAllByType(Pressable)
    .map((n) => n.props.accessibilityLabel);
  expect(labels).toEqual([
    `Copier le lien ${URL}`,
    `Partager le lien ${URL}`,
  ]);
});

test("copier place l’URL dans le presse-papiers et confirme", async () => {
  const tree = render();
  await act(async () => {
    pressByLabel(tree, `Copier le lien ${URL}`);
  });
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(URL);
  const texts = tree.root.findAll(
    (n) => typeof n.props?.children === "string",
  );
  expect(texts.some((n) => n.props.children === "Copié")).toBe(true);

  // L’indicateur « Copié » se retire tout seul.
  act(() => {
    jest.advanceTimersByTime(2500);
  });
  const after = tree.root.findAll((n) => typeof n.props?.children === "string");
  expect(after.some((n) => n.props.children === "Copié")).toBe(false);
});

test("partager ouvre la feuille de partage native", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: "sharedAction" });
  const tree = render();
  await act(async () => {
    pressByLabel(tree, `Partager le lien ${URL}`);
  });
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: URL }));
  share.mockRestore();
});

test("n’affiche rien sans URL", () => {
  const tree = render("");
  expect(tree.root.findAllByType(Pressable)).toHaveLength(0);
});
