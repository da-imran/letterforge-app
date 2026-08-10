const fs = require('fs');
const path = require('path');
const { HOSTNAME, PORT } = require('../utilities/env');

const doc = {
  swagger: '2.0',
  info: {
    title: 'Letter Forge Engine API',
    description: 'API Documentation for Letter Forge Engine',
    version: '1.0.0'
  },
  host: `${HOSTNAME}:${PORT}`,
  basePath: '/letter-forge/v1',
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'JWT bearer token (format: "Bearer <token>")'
    }
  },
  tags: [
    { name: 'meta', description: 'API metadata and health checks' },
    { name: 'auth', description: 'Authentication endpoints' },
    { name: 'games', description: 'Game management endpoints' },
    { name: 'users', description: 'User management endpoints' },
    { name: 'scores', description: 'Score tracking endpoints' },
    { name: 'leaderboard', description: 'Leaderboard endpoints' },
    { name: 'milestones', description: 'Milestone and achievement endpoints' }
  ],
  paths: {
    '/meta': {
      get: {
        tags: ['meta'],
        summary: 'Get engine metadata',
        description: 'Returns service information, available game modes, and configuration',
        responses: { '200': { description: 'OK' } }
      }
    },
    '/health': {
      get: {
        tags: ['meta'],
        summary: 'Health check',
        description: 'Returns the health status of the engine',
        responses: { '200': { description: 'OK' } }
      }
    },
    '/auth/register': {
      post: {
        tags: ['auth'],
        summary: 'Register a new account',
        description: 'Creates an account and returns a JWT token',
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                nickname: { type: 'string' },
                password: { type: 'string', minLength: 8 }
              },
              required: ['email', 'password']
            }
          }
        ],
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Bad Request' },
          '409': { description: 'Email already exists' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Log in and receive a token',
        description: 'Authenticates an account and returns a JWT token',
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                password: { type: 'string' }
              },
              required: ['email', 'password']
            }
          }
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Invalid email or password' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Get the authenticated user',
        description: 'Returns the currently authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Authentication required' }
        }
      }
    },
    '/games': {
      post: {
        tags: ['games'],
        summary: 'Create a new game',
        description: 'Creates a new game with specified mode (normal_mode, time_attack, survival_mode, or chain_mode)',
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                mode: { type: 'string', enum: ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'], description: 'Game mode' },
                letterCount: { type: 'integer', description: 'Number of letters (2 to 5)' },
                letters: { type: 'array', items: { type: 'string' }, description: 'Predetermined letters (optional)' },
                userId: { type: 'string', description: 'User ID (optional)' }
              },
              required: ['mode']
            }
          }
        ],
        responses: { '201': { description: 'Created' } }
      }
    },
    '/games/{gameId}': {
      get: {
        tags: ['games'],
        summary: 'Load a game',
        description: 'Loads an existing game by its ID',
        parameters: [{ name: 'gameId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' } }
      },
      delete: {
        tags: ['games'],
        summary: 'Delete a game',
        description: 'Permanently deletes an in-progress game. Completed games cannot be deleted.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'gameId', in: 'path', required: true, type: 'string' }],
        responses: {
          '200': { description: 'Game deleted' },
          '400': { description: 'Completed games cannot be deleted' },
          '401': { description: 'Authentication required' },
          '403': { description: 'Not the game owner' },
          '404': { description: 'Game not found' }
        }
      }
    },
    '/games/{gameId}/submit': {
      post: {
        tags: ['games'],
        summary: 'Submit a word',
        description: 'Submits a word for a specific game',
        parameters: [
          { name: 'gameId', in: 'path', required: true, type: 'string' },
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                word: { type: 'string', example: 'sea' }
              },
              required: ['word']
            }
          }
        ],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/games/{gameId}/reset': {
      post: {
        tags: ['games'],
        summary: 'Reset letters',
        description: 'Generates new random letters and clears used words',
        parameters: [
          { name: 'gameId', in: 'path', required: true, type: 'string' },
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                letterCount: { type: 'integer', example: 3 }
              }
            }
          }
        ],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/games/{gameId}/complete': {
      post: {
        tags: ['games'],
        summary: 'Complete the game',
        description: 'Marks the game as completed',
        parameters: [{ name: 'gameId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/games/{gameId}/batch': {
      post: {
        tags: ['games'],
        summary: 'Refill letter batch',
        description: 'Generates a new batch of 10 letter sets for batch-enabled modes when current batch is nearly exhausted',
        parameters: [{ name: 'gameId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' }, '400': { description: 'Game mode does not support batch generation' } }
      }
    },
    '/games/{gameId}/result': {
      get: {
        tags: ['games'],
        summary: 'Get game result',
        description: 'Returns the final result of the game',
        parameters: [{ name: 'gameId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/games/{gameId}/leaderboard': {
      post: {
        tags: ['games'],
        summary: 'Submit game score to leaderboard',
        description: 'Submits the final game score to the leaderboard',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'gameId', in: 'path', required: true, type: 'string' },
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                period: { type: 'string', enum: ['daily', 'weekly', 'all_time'], default: 'all_time' }
              }
            }
          }
        ],
        responses: {
          '200': { description: 'OK' },
          '400': { description: 'Bad Request' },
          '404': { description: 'Not Found' }
        }
      }
    },
    '/users': {
      get: {
        tags: ['users'],
        summary: 'Get user by nickname',
        description: 'Returns a user by their nickname',
        parameters: [{ name: 'nickname', in: 'query', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' }, '404': { description: 'User not found' } }
      },
      post: {
        tags: ['users'],
        summary: 'Create a new user',
        description: 'Creates a new user with the provided email and/or nickname',
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                nickname: { type: 'string' }
              }
            }
          }
        ],
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Bad Request' },
          '409': { description: 'Email already exists' }
        }
      }
    },
    '/users/{userId}': {
      get: {
        tags: ['users'],
        summary: 'Get user by ID',
        description: 'Returns a user by their ID',
        parameters: [{ name: 'userId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' }, '404': { description: 'User not found' } }
      },
      put: {
        tags: ['users'],
        summary: 'Update user',
        description: "Updates a user's information",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, type: 'string' },
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                nickname: { type: 'string' }
              }
            }
          }
        ],
        responses: {
          '200': { description: 'OK' },
          '404': { description: 'User not found' },
          '409': { description: 'Nickname already exists' }
        }
      },
      delete: {
        tags: ['users'],
        summary: 'Delete user',
        description: 'Deletes a user by their ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' }, '404': { description: 'User not found' } }
      }
    },
    '/users/{userId}/stats': {
      get: {
        tags: ['users'],
        summary: 'Get aggregate stats for a user',
        description: 'Returns per-mode total score and game count for completed games',
        parameters: [{ name: 'userId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' }, '400': { description: 'Invalid user ID' } }
      }
    },
    '/scores': {
      post: {
        tags: ['scores'],
        summary: 'Create a new score',
        description: 'Creates a score entry for a game',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                gameId: { type: 'string' },
                mode: { type: 'string', enum: ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'] },
                points: { type: 'integer' }
              },
              required: ['userId', 'gameId', 'mode', 'points']
            }
          }
        ],
        responses: { '201': { description: 'Created' }, '400': { description: 'Bad Request' } }
      }
    },
    '/scores/game/{gameId}': {
      get: {
        tags: ['scores'],
        summary: 'Get scores by game ID',
        description: 'Returns all scores for a specific game',
        parameters: [{ name: 'gameId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/scores/user/{userId}': {
      get: {
        tags: ['scores'],
        summary: 'Get scores by user ID',
        description: 'Returns all scores for a specific user',
        parameters: [{ name: 'userId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/scores/user/{userId}/total': {
      get: {
        tags: ['scores'],
        summary: 'Get total score by user',
        description: 'Returns total score and count for a user',
        parameters: [
          { name: 'userId', in: 'path', required: true, type: 'string' },
          { name: 'mode', in: 'query', required: true, type: 'string', enum: ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'] },
          { name: 'period', in: 'query', required: true, type: 'string', enum: ['daily', 'weekly', 'all_time'] }
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } }
      }
    },
    '/leaderboard': {
      get: {
        tags: ['leaderboard'],
        summary: 'Get leaderboard rankings',
        description: 'Returns paginated leaderboard rankings',
        parameters: [
          { name: 'mode', in: 'query', required: true, type: 'string', enum: ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'] },
          { name: 'period', in: 'query', required: true, type: 'string', enum: ['daily', 'weekly', 'all_time'] },
          { name: 'limit', in: 'query', type: 'integer', default: 10 },
          { name: 'offset', in: 'query', type: 'integer', default: 0 }
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } }
      }
    },
    '/leaderboard/submit': {
      post: {
        tags: ['leaderboard'],
        summary: 'Submit game score',
        description: "Submit or update a user's score in the leaderboard",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                mode: { type: 'string', enum: ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'] },
                period: { type: 'string', enum: ['daily', 'weekly', 'all_time'] },
                score: { type: 'integer' }
              },
              required: ['userId', 'mode', 'period', 'score']
            }
          }
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } }
      }
    },
    '/leaderboard/rank/{userId}': {
      get: {
        tags: ['leaderboard'],
        summary: "Get user's rank",
        description: "Returns user's rank in a specific leaderboard",
        parameters: [
          { name: 'userId', in: 'path', required: true, type: 'string' },
          { name: 'mode', in: 'query', required: true, type: 'string', enum: ['normal_mode', 'time_attack', 'survival_mode', 'chain_mode'] },
          { name: 'period', in: 'query', required: true, type: 'string', enum: ['daily', 'weekly', 'all_time'] }
        ],
        responses: { '200': { description: 'OK' }, '404': { description: 'User not found in leaderboard' } }
      }
    },
    '/leaderboard/all': {
      get: {
        tags: ['leaderboard'],
        summary: 'Get all leaderboard data',
        description: 'Returns all leaderboard rankings for all modes and periods',
        parameters: [{ name: 'limit', in: 'query', type: 'integer', default: 10 }],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/milestones': {
      get: {
        tags: ['milestones'],
        summary: 'Get all milestones',
        description: 'Returns all milestone templates',
        responses: { '200': { description: 'OK' } }
      }
    },
    '/milestones/initialize': {
      post: {
        tags: ['milestones'],
        summary: 'Initialize milestones',
        description: 'Seed milestones data if not exists',
        responses: { '200': { description: 'OK' } }
      }
    },
    '/milestones/{milestoneId}': {
      get: {
        tags: ['milestones'],
        summary: 'Get milestone by ID',
        description: 'Returns a specific milestone',
        parameters: [{ name: 'milestoneId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Milestone not found' } }
      }
    },
    '/milestones/user/{userId}': {
      get: {
        tags: ['milestones'],
        summary: 'Get user milestones',
        description: 'Returns completed milestones for a user',
        parameters: [{ name: 'userId', in: 'path', required: true, type: 'string' }],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/milestones/check/{userId}': {
      post: {
        tags: ['milestones'],
        summary: 'Check and unlock milestones',
        description: 'Computes real stats from completed games and unlocks any achieved milestones',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, type: 'string' },
          {
            name: 'body',
            in: 'body',
            description: 'Ignored - stats are computed server-side',
            schema: {
              type: 'object',
              properties: {}
            }
          }
        ],
        responses: { '200': { description: 'OK' } }
      }
    }
  }
};

const outputFile = path.join(__dirname, 'swagger-output.json');
fs.writeFileSync(outputFile, JSON.stringify(doc, null, 2));
console.log('Swagger documentation generated at', outputFile);
