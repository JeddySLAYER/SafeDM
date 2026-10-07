import path from "path";
import fs from "fs";
import chalk from "chalk";

export default function updatePopupPlugin() {
  let updatePopup;

  const indexHtmlPath = path.resolve(__dirname, "../dev/index.html");
  let debounceTimer = null;

  async function initReloadServer() {
    if (!updatePopup) {
      const reloadServer = await import("../reload-server.js");
      updatePopup = reloadServer.updatePopup;
    }
  }

  function setupIndexHtmlWatcher() {
    if (fs.existsSync(indexHtmlPath)) {
      console.log(chalk.magenta.bold('[WATCH]') + chalk.gray(' Watching index.html for changes\n'));
      
      fs.watch(indexHtmlPath, { persistent: true }, (eventType) => {
        if (eventType === "change") {
          console.log(chalk.blue.bold('[CHANGE]') + chalk.gray(' index.html detected'));

          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            try {
              const stats = fs.statSync(indexHtmlPath);
              if (stats.size > 0) {
                const content = fs.readFileSync(indexHtmlPath, "utf8");
                if (content.includes("</html>")) {
                  updatePopup?.();
                  console.log(chalk.green.bold('[UPDATE]') + chalk.gray(' Popup updated successfully\n'));
                } else {
                  console.log(chalk.yellow.bold('[WAIT]') + chalk.gray(' Waiting for complete HTML...'));
                }
              }
            } catch (err) {
              console.error(chalk.red.bold('[ERROR]') + chalk.gray(' Popup update failed:'), err.message);
            }
          }, 100);
        }
      });
    } else {
      console.warn(chalk.yellow.bold('[WARN]') + chalk.gray(' index.html not found at ') + chalk.yellow(indexHtmlPath));
    }
  }

  return {
    name: "update-popup-plugin",
    apply: "build",

    async closeBundle() {
      console.log(chalk.blue.bold('[POPUP PLUGIN]') + chalk.gray(' Initializing...\n'));
      await initReloadServer();
      setupIndexHtmlWatcher();
    },
  };
}