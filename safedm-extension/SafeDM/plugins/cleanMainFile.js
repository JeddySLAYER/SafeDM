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

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function cleanMainFile() {
  return {
    name: 'clean-main-file',
    enforce: 'pre', // Run before other plugins
    transform(code, id) {
      // Only process main.jsx
      if (!id.endsWith('src/main.jsx')) {
        return null;
      }

      // Remove HMR code blocks
      const cleaned = code.replace(/\/\/\s*HMR-START[\s\S]*?\/\/\s*HMR-END/g, '');
      
      // Log the transformation
      const originalSize = Buffer.byteLength(code, 'utf8');
      const cleanedSize = Buffer.byteLength(cleaned, 'utf8');
      log(
        'success',
        'CLEAN',
        'main.jsx (WebSocket connections removed)',
        `(${formatSize(originalSize)} → ${formatSize(cleanedSize)})`
      );

      return {
        code: cleaned,
        map: null // Set to null if you don't need source maps, or generate one if needed
      };
    }
  };
}