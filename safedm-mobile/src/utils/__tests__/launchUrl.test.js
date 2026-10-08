/* eslint-env jest */

import { isIgnorableLaunchUrl } from "../launchUrl";

describe("launch urls", () => {
  test("ignores the Metro address of the computer", () => {
    expect(isIgnorableLaunchUrl("http://192.168.0.106:8081")).toBe(true);
    expect(
      isIgnorableLaunchUrl(
        "exp+safedm-mobile://expo-development-client/?url=http://192.168.0.106:8081",
      ),
    ).toBe(true);
  });

  test("keeps a normal link", () => {
    expect(isIgnorableLaunchUrl("https://example.com/login")).toBe(false);
  });
});
