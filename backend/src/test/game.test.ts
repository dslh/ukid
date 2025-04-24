import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { GameState } from '../models/GameState';
import { streamResponse } from '../test/mocks/claude';

vi.mock('../services/claude', () => vi.importActual('../test/mocks/claude'));

describe('Game API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamResponse.mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello, world!' }
        };
      }
    }));
  });

  describe('POST /api/game/start', () => {
    it('should start a new game', async () => {
      const response = await (request(app) as any)
        .post('/api/game/start')
        .expect(200);

      expect(response.body).toHaveProperty('gameId');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('room');
      expect(response.body.message).toContain('door');
      expect(response.body.message).toContain('key');

      // Verify game state was saved
      const gameState = await GameState.findById(response.body.gameId);
      expect(gameState).toBeTruthy();
      expect(gameState?.messages).toHaveLength(1);
      expect(gameState?.messages[0].role).toBe('assistant');
    });
  });

  describe('POST /api/game/:gameId/action', () => {
    let gameId: string;

    beforeEach(async () => {
      // Start a new game for each test
      const response = await (request(app) as any).post('/api/game/start');
      gameId = response.body.gameId;
    });

    it('should process a valid action', async () => {
      const response = await (request(app) as any)
        .post(`/api/game/${gameId}/action`)
        .send({ action: 'look around' })
        .expect(200);

      // Verify SSE response
      expect(response.text).toContain('data: {"text":');
      expect(response.text).toContain('[DONE]');

      // Verify game state was updated
      const gameState = await GameState.findById(gameId);
      expect(gameState?.messages).toHaveLength(3); // Initial + user action + assistant response

      expect(streamResponse).toHaveBeenCalled();
    });

    it('should return 404 for non-existent game', async () => {
      await (request(app) as any)
        .post('/api/game/0123456789abcdef01234567/action')
        .send({ action: 'look around' })
        .expect(404);
    });

    it('should handle invalid action format', async () => {
      await (request(app) as any)
        .post(`/api/game/${gameId}/action`)
        .send({}) // Missing action
        .expect(400);
    });
  });
}); 