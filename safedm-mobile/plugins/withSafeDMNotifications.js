const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  withMainActivity,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE_IMPORT = "import com.safedmmobile.notifications.SafeDMNotificationsPackage";
const PACKAGE_ADD = "packages.add(SafeDMNotificationsPackage())";
const MAIN_ACTIVITY_IMPORT =
  "import com.safedmmobile.notifications.SafeDMNotificationsModule\nimport android.content.Intent";

/** Harnesses + unused classifiers — never ship in the app source set. */
const SKIP_KOTLIN = new Set([
  "FastTextRuntime.kt",
  "LocalTextClassifier.kt",
]);

function shouldSkipKotlinSource(fileName) {
  return fileName.endsWith("Check.kt") || SKIP_KOTLIN.has(fileName);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function packageToRelPath(packageName) {
  return packageName.split(".").join(path.sep);
}

function readKotlinPackage(filePath) {
  const head = fs.readFileSync(filePath, "utf8").slice(0, 4000);
  const match = head.match(/^\s*package\s+([a-zA-Z0-9_.]+)/m);
  return match ? match[1] : "com.safedmmobile.notifications";
}

function copyKotlinSources(projectRoot, platformProjectRoot) {
  const srcDir = path.join(projectRoot, "plugins", "safedm-nls", "android");
  const javaRoot = path.join(
    platformProjectRoot,
    "app",
    "src",
    "main",
    "java",
  );

  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith(".kt")) continue;
    if (shouldSkipKotlinSource(file)) continue;

    const srcPath = path.join(srcDir, file);
    const pkg = readKotlinPackage(srcPath);
    const destDir = path.join(javaRoot, packageToRelPath(pkg));
    ensureDir(destDir);
    fs.copyFileSync(srcPath, path.join(destDir, file));
  }

  const xmlSrc = path.join(
    projectRoot,
    "plugins",
    "safedm-nls",
    "network_security_config.xml",
  );
  const xmlDestDir = path.join(
    platformProjectRoot,
    "app",
    "src",
    "main",
    "res",
    "xml",
  );
  ensureDir(xmlDestDir);
  fs.copyFileSync(xmlSrc, path.join(xmlDestDir, "network_security_config.xml"));
}

function addNotificationListenerService(androidManifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  if (!app.service) app.service = [];

  const existing = app.service.find(
    (s) =>
      s.$?.["android:name"] ===
      ".notifications.SafeDMNotificationListenerService",
  );
  if (!existing) {
    app.service.push({
      $: {
        "android:name": ".notifications.SafeDMNotificationListenerService",
        "android:label": "@string/app_name",
        "android:permission":
          "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name":
                  "android.service.notification.NotificationListenerService",
              },
            },
          ],
        },
      ],
    });
  }

  if (!androidManifest.manifest.queries) {
    androidManifest.manifest.queries = [];
  }
  const queries = androidManifest.manifest.queries;
  const hasLauncherQuery = queries.some((q) =>
    JSON.stringify(q).includes("android.intent.category.LAUNCHER"),
  );
  if (!hasLauncherQuery) {
    queries.push({
      intent: [
        {
          action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
          category: [
            { $: { "android:name": "android.intent.category.LAUNCHER" } },
          ],
        },
      ],
    });
  }
  const hasHttpsQuery = queries.some((q) =>
    JSON.stringify(q).includes('"android:scheme":"https"'),
  );
  if (!hasHttpsQuery) {
    queries.push({
      intent: [
        {
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          category: [
            { $: { "android:name": "android.intent.category.BROWSABLE" } },
          ],
          data: [{ $: { "android:scheme": "https" } }],
        },
      ],
    });
  }

  // Cleartext only when Expo build-properties allow it (dev). Release APKs
  // must talk HTTPS (or localhost via network_security_config exceptions).
  const allowCleartext =
    process.env.APP_ENV !== "production" &&
    process.env.EAS_BUILD_PROFILE !== "production" &&
    process.env.EAS_BUILD_PROFILE !== "apk";
  if (allowCleartext) {
    app.$["android:usesCleartextTraffic"] = "true";
  } else {
    delete app.$["android:usesCleartextTraffic"];
  }
  app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
  return androidManifest;
}

function patchMainApplication(contents) {
  let next = contents;
  if (!next.includes(PACKAGE_IMPORT)) {
    if (next.includes("import com.facebook.react.PackageList")) {
      next = next.replace(
        "import com.facebook.react.PackageList",
        `import com.facebook.react.PackageList\n${PACKAGE_IMPORT}`,
      );
    } else if (next.includes("package com.safedmmobile")) {
      next = next.replace(
        /package com\.safedmmobile\s*/,
        `package com.safedmmobile\n\n${PACKAGE_IMPORT}\n`,
      );
    }
  }

  if (!next.includes(PACKAGE_ADD)) {
    if (next.includes("PackageList(this).packages.apply")) {
      next = next.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {\n              ${PACKAGE_ADD}`,
      );
    } else if (next.includes("packages = PackageList(this).packages")) {
      next = next.replace(
        "packages = PackageList(this).packages",
        `packages = PackageList(this).packages\n            ${PACKAGE_ADD}`,
      );
    }
  }
  return next;
}

function patchMainActivity(contents) {
  let next = contents;
  if (!next.includes("SafeDMNotificationsModule")) {
    if (next.includes("import android.os.Bundle")) {
      next = next.replace(
        "import android.os.Bundle",
        `import android.os.Bundle\nimport android.content.Intent\nimport com.safedmmobile.notifications.SafeDMNotificationsModule`,
      );
    } else {
      next = next.replace(
        "package com.safedmmobile",
        `package com.safedmmobile\n\n${MAIN_ACTIVITY_IMPORT}`,
      );
    }
  }
  if (!next.includes("override fun onNewIntent")) {
    next = next.replace(
      /override fun getMainComponentName\(\): String = "main"/,
      `override fun getMainComponentName(): String = "main"

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    SafeDMNotificationsModule.onNewIntent(intent)
  }`,
    );
  }
  return next;
}

function withSafeDMNotifications(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      copyKotlinSources(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = addNotificationListenerService(cfg.modResults);
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    if (cfg.modResults.language === "kt" || cfg.modResults.contents) {
      cfg.modResults.contents = patchMainApplication(cfg.modResults.contents);
    }
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    if (cfg.modResults.contents) {
      cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    }
    return cfg;
  });

  return config;
}

module.exports = withSafeDMNotifications;
