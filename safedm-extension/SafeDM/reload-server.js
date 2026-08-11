import { WebSocketServer } from 'ws';
import chalk from 'chalk';

const PORT = 8081;
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(chalk.green.bold('[WS]') + chalk.gray(' Extension connected to reload server') + chalk.cyan(` (${clients.size} active)`));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(chalk.yellow.bold('[WS]') + chalk.gray(' Extension disconnected') + chalk.cyan(` (${clients.size} remaining)`));
  });

  ws.on('error', (err) => {
    console.error(chalk.red.bold('[ERROR]') + chalk.gray(' WebSocket error:'), err.message);
    clients.delete(ws);
  });
});

// Function to trigger reload for all connected extensions
export function reloadExtension() {
  if (clients.size === 0) {
    console.log(chalk.yellow.bold('[RELOAD]') + chalk.gray(' No extensions connected'));
    return;
  }
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify({ type: 'reload' }));
    }
  });
  console.log(chalk.magenta.bold('[RELOAD]') + chalk.gray(` Sent reload to ${clients.size} connected extension(s)`));
}

export function updatePopup(){
  if (clients.size === 0) {
    console.log(chalk.yellow.bold('[UPDATE]') + chalk.gray(' No extensions connected'));
    return;
  }
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify({ type: 'update' }));
    }
  });
  console.log(chalk.blue.bold('[UPDATE]') + chalk.gray(` Sent update to ${clients.size} connected extension(s)`));
}

console.log('\n' + chalk.green.bold('[SERVER]') + chalk.gray(' Extension reload server running on ') + chalk.cyan.underline(`ws://localhost:${PORT}`) + '\n');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n' + chalk.yellow.bold('[SERVER]') + chalk.gray(' Shutting down reload server...'));
  wss.close();
  process.exit(0);
});