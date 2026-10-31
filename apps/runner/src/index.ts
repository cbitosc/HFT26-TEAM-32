import { buildServer } from './server.js';
import { runnerConfig } from './config.js';

const server = buildServer();

server.listen({ port: runnerConfig.PORT, host: runnerConfig.HOST }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`Proctor-Forge Hardened Sandbox Runner listening at ${address}`);
});

