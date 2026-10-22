/* eslint-env jest */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getNotificationPreferences,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_DETAILS,
  notificationIdFor,
  notify,
  setNotificationEnabled,
} from "../notifications";

describe("types de notification", () => {
  test("chaque type a un canal et un libelle", () => {
    for (const spec of Object.values(NOTIFICATION_TYPE_DETAILS)) {
      expect(["alerts", "info", "quiet"]).toContain(spec.channel);
      expect(typeof spec.label).toBe("string");
      expect(spec.label.length).toBeGreaterThan(0);
      expect(typeof spec.defaultEnabled).toBe("boolean");
    }
  });

  test("le resume quotidien est desactive par defaut", () => {
    expect(NOTIFICATION_TYPE_DETAILS[NOTIFICATION_TYPES.DAILY_DIGEST].defaultEnabled).toBe(false);
  });

  test("les alertes de securite sont activees par defaut", () => {
    expect(NOTIFICATION_TYPE_DETAILS[NOTIFICATION_TYPES.THREAT_DETECTED].defaultEnabled).toBe(true);
    expect(NOTIFICATION_TYPE_DETAILS[NOTIFICATION_TYPES.SUSPICIOUS_DETECTED].defaultEnabled).toBe(true);
    expect(NOTIFICATION_TYPE_DETAILS[NOTIFICATION_TYPES.LINK_BLOCKED].defaultEnabled).toBe(true);
  });
});

describe("preferences de notification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  test("les valeurs absentes prennent les defauts", async () => {
    const prefs = await getNotificationPreferences();
    expect(prefs[NOTIFICATION_TYPES.THREAT_DETECTED]).toBe(true);
    expect(prefs[NOTIFICATION_TYPES.DAILY_DIGEST]).toBe(false);
  });

  test("une valeur enregistree est conservee", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ [NOTIFICATION_TYPES.DAILY_DIGEST]: true }),
    );
    const prefs = await getNotificationPreferences();
    expect(prefs[NOTIFICATION_TYPES.DAILY_DIGEST]).toBe(true);
    expect(prefs[NOTIFICATION_TYPES.THREAT_DETECTED]).toBe(true);
  });

  test("une preference corrompue retombe sur les defauts", async () => {
    AsyncStorage.getItem.mockResolvedValue("{pas du json");
    const prefs = await getNotificationPreferences();
    expect(prefs[NOTIFICATION_TYPES.THREAT_DETECTED]).toBe(true);
  });

  test("setNotificationEnabled persiste et refuse un type inconnu", async () => {
    const result = await setNotificationEnabled(NOTIFICATION_TYPES.DAILY_DIGEST, true);
    expect(result).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
    const saved = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(saved[NOTIFICATION_TYPES.DAILY_DIGEST]).toBe(true);

    await setNotificationEnabled("type_inconnu", true);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
});

describe("identifiant de notification", () => {
  test("est stable et positif", () => {
    const first = notificationIdFor("threat_detected:abc");
    expect(first).toBe(notificationIdFor("threat_detected:abc"));
    expect(first).toBeGreaterThan(0);
    expect(first).not.toBe(notificationIdFor("threat_detected:abd"));
  });
});

describe("publication", () => {
  const postNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    postNotification.mockResolvedValue(true);
    NativeModules.SafeDMNotifier = {
      areNotificationsEnabled: jest.fn(async () => true),
      ensureChannels: jest.fn(async () => true),
      postNotification,
      cancelAll: jest.fn(async () => true),
      getLaunchPayload: jest.fn(async () => null),
    };
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  test("publie quand le type est actif et le systeme autorise", async () => {
    const posted = await notify(NOTIFICATION_TYPES.THREAT_DETECTED, {
      title: "Menace détectée",
      body: "Un message a été classé dangereux.",
      data: { alertId: "a-1" },
    });
    expect(posted).toBe(true);
    expect(postNotification).toHaveBeenCalledTimes(1);
    const payload = postNotification.mock.calls[0][0];
    expect(payload.channel).toBe("alerts");
    expect(payload.title).toBe("Menace détectée");
    expect(JSON.parse(payload.data)).toEqual({
      type: NOTIFICATION_TYPES.THREAT_DETECTED,
      alertId: "a-1",
    });
  });

  test("ne publie pas un type desactive par l'utilisateur", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ [NOTIFICATION_TYPES.THREAT_DETECTED]: false }),
    );
    const posted = await notify(NOTIFICATION_TYPES.THREAT_DETECTED, { title: "x", body: "y" });
    expect(posted).toBe(false);
    expect(postNotification).not.toHaveBeenCalled();
  });

  test("ne publie pas si le systeme refuse les notifications", async () => {
    NativeModules.SafeDMNotifier.areNotificationsEnabled.mockResolvedValue(false);
    const posted = await notify(NOTIFICATION_TYPES.THREAT_DETECTED, { title: "x", body: "y" });
    expect(posted).toBe(false);
    expect(postNotification).not.toHaveBeenCalled();
  });

  test("une erreur native ne remonte pas", async () => {
    postNotification.mockRejectedValue(new Error("boom"));
    await expect(
      notify(NOTIFICATION_TYPES.LINK_BLOCKED, { title: "x", body: "y" }),
    ).resolves.toBe(false);
  });
});
