/* eslint-env jest */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("../../api/analysis", () => ({ analyzeMessage: jest.fn() }));
jest.mock("../../utils/storage", () => ({
  getCloudConsent: jest.fn(async () => false),
  getToken: jest.fn(async () => null),
}));
jest.mock("../alertsEvents", () => ({ emitAlertsChanged: jest.fn() }));
jest.mock("../localThreatClassifier", () => ({
  classifyLocalFeatures: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { classifyLocalFeatures } from "../localThreatClassifier";
import { addAlertFromNotification } from "../alertsStore";

describe("notification alert fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue("[]");
    classifyLocalFeatures.mockResolvedValue({
      decision: "UNAVAILABLE",
      confidence: null,
      riskScore: null,
    });
  });

  test("does not treat an unverified offline URL score as malicious", async () => {
    const features = new Array(50).fill(0);
    features[15] = 128; // known_bad_url = not checked while offline

    const alert = await addAlertFromNotification({
      title: "Message",
      text: "Bonjour, comment vas-tu ?",
      features,
    });

    expect(alert.level).toBe("unknown");
    expect(alert.riskScore).toBeNull();
    expect(alert.decisionSource).toBe("feature-fallback");
  });

  test("keeps an explicitly malicious URL signal high", async () => {
    const features = new Array(50).fill(0);
    features[15] = 255; // known_bad_url = verified malicious

    const alert = await addAlertFromNotification({
      title: "Message",
      text: "Lien vérifié comme malveillant",
      features,
    });

    expect(alert.level).toBe("high");
  });
});
