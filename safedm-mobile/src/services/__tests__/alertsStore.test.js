/* eslint-env jest */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("../../api/analysis", () => ({ analyzeMessage: jest.fn() }));
jest.mock("../../utils/storage", () => ({
  getCloudConsent: jest.fn(async () => false),
  getToken: jest.fn(async () => null),
  getHideSensitivePreview: jest.fn(async () => false),
}));
jest.mock("../alertsEvents", () => ({ emitAlertsChanged: jest.fn() }));
jest.mock("../localThreatClassifier", () => ({
  classifyLocalFeatures: jest.fn(),
}));
jest.mock("../notifications", () => ({
  NOTIFICATION_TYPES: {
    THREAT_DETECTED: "threat_detected",
    SUSPICIOUS_DETECTED: "suspicious_detected",
  },
  notify: jest.fn(async () => true),
  notifyProtectionDegraded: jest.fn(async () => false),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { classifyLocalFeatures } from "../localThreatClassifier";
import { notify, NOTIFICATION_TYPES } from "../notifications";
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

describe("notification systeme d'une alerte", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue("[]");
  });

  test("prevenit l'utilisateur quand le modele classe le message dangereux", async () => {
    classifyLocalFeatures.mockResolvedValue({
      decision: "DANGEROUS",
      confidence: 0.91,
      riskScore: 88,
      modelSource: "tflite",
    });

    await addAlertFromNotification({
      title: "Orange",
      text: "Votre compte est bloque, cliquez ici http://bit.ly/x",
      packageName: "com.android.mms",
      features: new Array(50).fill(0),
    });

    expect(notify).toHaveBeenCalledTimes(1);
    const [type, options] = notify.mock.calls[0];
    expect(type).toBe(NOTIFICATION_TYPES.THREAT_DETECTED);
    expect(options.body).toContain("SMS");
  });

  test("ne previent pas pour un message benin", async () => {
    classifyLocalFeatures.mockResolvedValue({
      decision: "SAFE",
      confidence: 0.95,
      riskScore: 4,
      modelSource: "tflite",
    });

    await addAlertFromNotification({
      title: "Maman",
      text: "On se voit demain midi ?",
      packageName: "com.whatsapp",
      features: new Array(50).fill(0),
    });

    expect(notify).not.toHaveBeenCalled();
  });

  test("ne previent pas sur le repli lexical, trop bruyant", async () => {
    // Sans features : `guessLevel` classe « moyen » a cause du lien.
    await addAlertFromNotification({
      title: "Message",
      text: "Voici un lien vers notre site http://example.com",
      packageName: "com.android.mms",
    });

    expect(notify).not.toHaveBeenCalled();
  });

  test("ne previent pas en « moyen » sans decision du modele", async () => {
    const features = new Array(50).fill(0);
    features[2] = 255; // shortened_url

    await addAlertFromNotification({
      title: "Message",
      text: "Un lien court",
      packageName: "com.android.mms",
      features,
    });

    expect(notify).not.toHaveBeenCalled();
  });
});
