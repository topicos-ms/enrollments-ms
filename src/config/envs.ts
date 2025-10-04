import 'dotenv/config';
import * as Joi from 'joi';

interface EnvVars {
  PORT: number;
  NATS_SERVERS: string[];
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
}

const envSchema = Joi.object({
  PORT: Joi.number().default(3015),
  NATS_SERVERS: Joi.array().items(Joi.string()).min(1).required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().required(),
}).unknown(true);

const { error, value } = envSchema.validate({
  ...process.env,
  PORT: process.env.PORT ?? process.env.ENROLLMENTS_MS_PORT ?? 3015,
  NATS_SERVERS: process.env.NATS_SERVERS ? process.env.NATS_SERVERS.split(',') : [],
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  natsServers: envVars.NATS_SERVERS,
  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    name: envVars.DB_NAME,
  },
};
