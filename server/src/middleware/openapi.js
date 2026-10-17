import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import OpenApiValidator from 'express-openapi-validator';
import swaggerUi from 'swagger-ui-express';
import { bundle } from '@apidevtools/json-schema-ref-parser';

export const specPath = fileURLToPath(new URL('../../../docs/api/openapi.yaml', import.meta.url));

export function openApiValidator({ validateResponses }) {
  return OpenApiValidator.middleware({
    apiSpec: specPath,
    validateRequests: true,
    validateResponses,
    validateSecurity: false,
    $refParser: { mode: 'dereference' },
  });
}

export function apiDocs() {
  const router = Router();
  router.get('/openapi.json', async (_req, res) => res.json(await bundle(specPath)));
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(null, { swaggerOptions: { url: '/api/docs/openapi.json' } }),
  );
  return router;
}
