import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { runRoutes } from './routes/run.js';

export function buildServer(): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  app.register(cors, {
    origin: true
  });

  app.register(runRoutes);

  return app;
}

