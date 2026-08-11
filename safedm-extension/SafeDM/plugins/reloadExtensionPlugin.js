import path from "path";
import fs from "fs-extra";
import * as esbuild from "esbuild";
import chalk from "chalk";

// Utility function for formatted logging with timestamps
function log(level, tag, message, details = "") {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const colors = {
    info: chalk.cyan,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
    change: chalk.blue,
    reload: chalk.magenta,
  };

  const color = colors[level] || chalk.white;
  console.log(
    chalk.gray(`[${timestamp}]`) +
      " " +
      color.bold(`[${tag}]`) +
      " " +
      chalk.gray(message) +
      (details ? " " + chalk.yellow(details) : "")
  );
}

// Format file size
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function reloadExtensionPlugin(reload = true) {
  const manifestPath = path.resolve(__dirname, "../extension/manifest.json");
  const backgroundDir = path.resolve(__dirname, "../src/background");
  const contentDir = path.resolve(__dirname, "../src/content");
  const sharedDir = path.resolve(__dirname, "../src/shared");
  const buildDir = path.resolve(__dirname, reload ? "../dev" : "../build");
  const mode = reload ? "dev" : "build";

  let reloadExtension;
  let updatePopup;
  let buildStartTime;

  async function initReloadServer() {
    const reloadServer = await import("../reload-server.js");
    reloadExtension = reloadServer.reloadExtension;
    updatePopup = reloadServer.updatePopup;
    log("success", "PLUGIN", "Reload server initialized");
  }

  function ensureBuildDir() {
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
      log("info", "SETUP", `Created ${mode}/ directory`);
    }
  }

  function copyManifest() {
    ensureBuildDir();
    if (fs.existsSync(manifestPath)) {
      const extensionDir = path.dirname(manifestPath);
      fs.copySync(extensionDir, buildDir); // recursively copy all files
      const totalFiles = fs.readdirSync(extensionDir).length;
      log(
        "info",
        "COPY",
        `All extension files → ${mode}/`,
        `(${totalFiles} items)`
      );
    } else {
      log(
        "warn",
        "WARN",
        "Extension folder not found at",
        path.dirname(manifestPath)
      );
    }
  }

  async function copyBackground() {
    ensureBuildDir();
    if (!fs.existsSync(backgroundDir)) return;
    const destDir = path.join(buildDir, "background");
    fs.mkdirSync(destDir, { recursive: true });
    const files = fs.readdirSync(backgroundDir);
    let bundledCount = 0;
    let copiedCount = 0;
    let totalSize = 0;

    for (const f of files) {
      const srcPath = path.join(backgroundDir, f);
      const destPath = path.join(destDir, f);

      // Only bundle the service worker entry; leave helpers (e.g. handleReload) for import
      if (f === "background.js" || f === "background.ts") {
        try {
          let tempPath = srcPath;

          if (!reload) {
            let content = fs.readFileSync(srcPath, "utf8");
            content = content.replace(
              /\/\/\s*HMR-START[\s\S]*?\/\/\s*HMR-END/g,
              ""
            );
            // Keep temp next to source so relative imports (../shared) resolve
            tempPath = path.join(backgroundDir, `__temp_${f}`);
            fs.writeFileSync(tempPath, content);
          }

          await esbuild.build({
            entryPoints: [tempPath],
            bundle: true,
            outfile: destPath.replace(".ts", ".js"),
            format: "esm",
            target: "chrome100",
            minify: process.env.NODE_ENV === "production",
            sourcemap: process.env.NODE_ENV !== "production",
          });

          if (!reload && tempPath !== srcPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }

          const size = fs.statSync(destPath.replace(".ts", ".js")).size;
          totalSize += size;
          bundledCount++;
          log("success", "BUNDLE", f, `(${formatSize(size)})`);
        } catch (error) {
          log("warn", "WARN", `Could not bundle ${f}, copying instead`);
          console.error(chalk.red("  " + error.message));
          fs.copyFileSync(srcPath, destPath);
          totalSize += fs.statSync(destPath).size;
          copiedCount++;
        }
      } else if (f.endsWith(".js") || f.endsWith(".ts")) {
        // Still copy companions when not bundling into entry (dev HMR helpers unused after bundle)
        fs.copyFileSync(srcPath, destPath);
        totalSize += fs.statSync(destPath).size;
        copiedCount++;
      } else {
        fs.copyFileSync(srcPath, destPath);
        totalSize += fs.statSync(destPath).size;
        copiedCount++;
      }
    }

    const summary = [];
    if (bundledCount > 0) summary.push(chalk.green(`${bundledCount} bundled`));
    if (copiedCount > 0) summary.push(chalk.cyan(`${copiedCount} copied`));
    log(
      "info",
      "BACKGROUND",
      summary.join(chalk.gray(", ")) || "done",
      `(${formatSize(totalSize)} total)`
    );
  }

  async function copyContent() {
    ensureBuildDir();
    if (!fs.existsSync(contentDir)) return;

    const destDir = path.join(buildDir, "content");
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(contentDir);
    let bundledCount = 0;
    let copiedCount = 0;
    let totalSize = 0;

    for (const f of files) {
      const srcPath = path.join(contentDir, f);
      const destPath = path.join(destDir, f);

      if (f.endsWith(".js") || f.endsWith(".ts")) {
        try {
          let tempPath = srcPath;

          if (!reload) {
            let content = fs.readFileSync(srcPath, "utf8");
            content = content.replace(
              /\/\/\s*HMR-START[\s\S]*?\/\/\s*HMR-END/g,
              ""
            );
            tempPath = path.join(destDir, `__temp_${f}`);
            fs.writeFileSync(tempPath, content);
          }

          await esbuild.build({
            entryPoints: [tempPath],
            bundle: true,
            outfile: destPath.replace(".ts", ".js"),
            format: "iife",
            target: "chrome100",
            minify: process.env.NODE_ENV === "production",
            sourcemap: process.env.NODE_ENV !== "production",
          });

          if (!reload) fs.unlinkSync(tempPath);

          const size = fs.statSync(destPath.replace(".ts", ".js")).size;
          totalSize += size;
          bundledCount++;
          log("success", "BUNDLE", f, `(${formatSize(size)})`);
        } catch (error) {
          log("warn", "WARN", `Could not bundle ${f}, copying instead`);
          console.error(chalk.red("  " + error.message));
          fs.copyFileSync(srcPath, destPath);
          const size = fs.statSync(destPath).size;
          totalSize += size;
          copiedCount++;
        }
      } else {
        fs.copyFileSync(srcPath, destPath);
        const size = fs.statSync(destPath).size;
        totalSize += size;
        copiedCount++;
      }
    }

    const summary = [];
    if (bundledCount > 0) summary.push(chalk.green(`${bundledCount} bundled`));
    if (copiedCount > 0) summary.push(chalk.cyan(`${copiedCount} copied`));

    log(
      "info",
      "CONTENT",
      summary.join(chalk.gray(", ")),
      `(${formatSize(totalSize)} total)`
    );
  }

  async function setupWatchers() {
    await initReloadServer();
    console.log(
      chalk.magenta.bold("\n[WATCH]") + chalk.gray(" File watchers active\n")
    );

    if (fs.existsSync(path.dirname(manifestPath))) {
      const extensionDir = path.dirname(manifestPath);

      fs.watch(
        extensionDir,
        { recursive: true, persistent: true },
        (eventType, filename) => {
          if (!filename) return; // ignore missing filename events

          log("change", "CHANGE", `extension/${filename}`);

          try {
            copyManifest(); // copy all files under extension/
            reloadExtension?.();
            log("reload", "RELOAD", "Extension reloaded\n");
          } catch (err) {
            log("error", "ERROR", "Reload failed:", err.message);
          }
        }
      );

      log("info", "WATCH", `Watching ${extensionDir} for changes...`);
    } else {
      log(
        "warn",
        "WARN",
        "Extension folder not found:",
        path.dirname(manifestPath)
      );
    }

    if (fs.existsSync(backgroundDir)) {
      fs.watch(
        backgroundDir,
        { recursive: true, persistent: true },
        async (_, file) => {
          log("change", "CHANGE", "background/", file || "");
          await copyBackground();
          try {
            reloadExtension();
            log("reload", "RELOAD", "Extension reloaded\n");
          } catch (err) {
            log("error", "ERROR", "Reload failed:", err.message);
          }
        }
      );
    }

    if (fs.existsSync(sharedDir)) {
      fs.watch(
        sharedDir,
        { recursive: true, persistent: true },
        async (_, file) => {
          log("change", "CHANGE", "shared/", file || "");
          await copyBackground();
          try {
            reloadExtension();
            log("reload", "RELOAD", "Extension reloaded\n");
          } catch (err) {
            log("error", "ERROR", "Reload failed:", err.message);
          }
        }
      );
    }

    if (fs.existsSync(contentDir)) {
      fs.watch(
        contentDir,
        { recursive: true, persistent: true },
        async (_, file) => {
          log("change", "CHANGE", "content/", file || "");
          await copyContent();
          try {
            reloadExtension();
            log("reload", "RELOAD", "Extension reloaded\n");
          } catch (err) {
            log("error", "ERROR", "Reload failed:", err.message);
          }
        }
      );
    }
  }

  return {
    name: "reload-extension-plugin",
    apply: "build",

    async buildStart() {
      buildStartTime = Date.now();
      console.log(chalk.blue.bold("\n╭─────────────────────────────────╮"));
      console.log(
        chalk.blue.bold("│") +
          chalk.white.bold("     BUILD STARTED               ") +
          chalk.blue.bold("│")
      );
      console.log(chalk.blue.bold("╰─────────────────────────────────╯"));
      log("info", "BUILD", `Mode: ${mode.toUpperCase()}\n`);
      copyManifest();
      await copyBackground();
      await copyContent();
    },

    async closeBundle() {
      const duration = ((Date.now() - buildStartTime) / 1000).toFixed(2);

      console.log(chalk.green.bold("\n╭─────────────────────────────────╮"));
      console.log(
        chalk.green.bold("│") +
          chalk.white.bold("     BUILD COMPLETE              ") +
          chalk.green.bold("│")
      );
      console.log(chalk.green.bold("╰─────────────────────────────────╯"));
      log("success", "BUILD", `Completed in ${duration}s\n`);
      copyManifest();
      await copyBackground();
      await copyContent();

      reload && setupWatchers();
    },
  };
}