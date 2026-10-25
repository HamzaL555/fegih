export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Fegih API',
    version: '1.0.0',
    description: 'Database-driven REST API for the Fegih quiz, rewards and Islamic book store platform.',
  },
  servers: [{ url: '/api/v1', description: 'Current server' }],
  tags: [
    { name: 'Auth', description: 'Registration, login and token rotation' },
    { name: 'Quiz', description: 'Server-validated quiz games' },
    { name: 'Store', description: 'Books, cart and orders' },
    { name: 'Rewards', description: 'Points, daily rewards, achievements and missions' },
    { name: 'Islamic', description: 'Daily content, calendar and prayer times' },
    { name: 'Admin', description: 'Role-protected administration APIs' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
              details: {},
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            required: ['user', 'accessToken', 'refreshToken'],
            properties: {
              user: { type: 'object' },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['Auth'], summary: 'Database-aware health check', responses: { '200': { description: 'Service is healthy' } } },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a user',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Account created' }, '409': { description: 'Identifier already exists' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login with email, phone or username',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Authenticated', content: { 'application/json': { schema: { '$ref': '#/components/schemas/AuthResponse' } } } } },
      },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Rotate a refresh token', responses: { '200': { description: 'New token pair' } } },
    },
    '/users/me': {
      get: { tags: ['Auth'], security: [{ bearerAuth: [] }], summary: 'Current profile', responses: { '200': { description: 'Profile' } } },
      patch: { tags: ['Auth'], security: [{ bearerAuth: [] }], summary: 'Update current profile', responses: { '200': { description: 'Updated profile' } } },
    },
    '/questions': {
      get: { tags: ['Quiz'], summary: 'List active questions without correct answers', responses: { '200': { description: 'Paginated questions' } } },
    },
    '/quiz/start': {
      post: {
        tags: ['Quiz'], security: [{ bearerAuth: [] }], summary: 'Start a server-selected quiz game',
        responses: { '201': { description: 'Game created; correct answers are never sent' } },
      },
    },
    '/quiz/{gameId}/answer': {
      post: {
        tags: ['Quiz'], security: [{ bearerAuth: [] }], summary: 'Submit an answer for server validation',
        parameters: [{ name: 'gameId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Validated result and database-derived reward' }, '409': { description: 'Question was already answered' } },
      },
    },
    '/leaderboard': {
      get: { tags: ['Rewards'], summary: 'Daily, weekly, monthly or all-time leaderboard', responses: { '200': { description: 'Ranked users' } } },
    },
    '/books': {
      get: { tags: ['Store'], summary: 'List active books and live prices', responses: { '200': { description: 'Paginated books' } } },
    },
    '/cart': {
      get: { tags: ['Store'], security: [{ bearerAuth: [] }], summary: 'Current server-priced cart', responses: { '200': { description: 'Cart' } } },
    },
    '/orders': {
      get: { tags: ['Store'], security: [{ bearerAuth: [] }], summary: 'Current user orders', responses: { '200': { description: 'Orders' } } },
      post: { tags: ['Store'], security: [{ bearerAuth: [] }], summary: 'Create order and payment session atomically', responses: { '201': { description: 'Order created' } } },
    },
    '/admin/questions/import/preview': {
      post: { tags: ['Admin'], security: [{ bearerAuth: [] }], summary: 'Validate and preview a question JSON import', responses: { '200': { description: 'Row-level validation report' } } },
    },
    '/admin/dashboard': {
      get: { tags: ['Admin'], security: [{ bearerAuth: [] }], summary: 'Platform analytics', responses: { '200': { description: 'Dashboard statistics' } } },
    },
  },
} as const;
