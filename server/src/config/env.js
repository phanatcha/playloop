const read = (name, fallback) => process.env[name] || fallback;

export const env = Object.freeze({
  nodeEnv: read('NODE_ENV', 'development'),
  isProduction: read('NODE_ENV') === 'production',
  port: Number(read('PORT', 4000)),
  logLevel: read('LOG_LEVEL', 'info'),
  mongodbUri: read('MONGODB_URI'),
  jwtSecret: read('JWT_SECRET'),
  jwtExpiresIn: read('JWT_EXPIRES_IN', '7d'),
  clientOrigins: read('CLIENT_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),
  aws: {
    region: read('AWS_REGION', 'ap-southeast-1'),
    s3Endpoint: read('S3_ENDPOINT'),
    mediaBucket: read('S3_MEDIA_BUCKET'),
    buildsBucket: read('S3_BUILDS_BUCKET'),
    playBucket: read('S3_PLAY_BUCKET'),
    mediaCdnUrl: read('MEDIA_CDN_URL'),
    playCdnUrl: read('PLAY_CDN_URL'),
  },
  internalWebhookSecret: read('INTERNAL_WEBHOOK_SECRET'),
  payment: {
    secretKey: read('PAYMENT_SECRET_KEY'),
    webhookSecret: read('PAYMENT_WEBHOOK_SECRET'),
  },
});

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

export function assertEnv() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}
