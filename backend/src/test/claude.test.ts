import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Anthropic } from '@anthropic-ai/sdk';
import { GameState } from '../models/GameState';
import { systemPrompt } from '../utils/prompts';

// Mock the Anthropic client
vi.mock('@anthropic-ai/sdk');

describe('Claude API Integration', () => {
  let mockAnthropic: ReturnType<typeof vi.mocked<Anthropic>>;

  beforeEach(() => {
    mockAnthropic = vi.mocked(new Anthropic());
    vi.clearAllMocks();
  });

  it('should process game actions correctly', async () => {
    // Mock the stream response
    const mockStream = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            return {
              done: true,
              value: {
                type: 'content_block_delta',
                delta: {
                  type: 'text_delta',
                  text: 'The key is stuck to the table with superglue.'
                }
              }
            };
          }
        };
      }
    };

    mockAnthropic.messages.stream.mockResolvedValue(mockStream as any);

    // Create a test game state
    const gameState = await GameState.create({
      messages: [
        {
          role: 'assistant',
          content: 'You are in a room with a locked door. There is a key on a table in the middle of the room. What would you like to do?'
        },
        {
          role: 'user',
          content: 'take key'
        }
      ]
    });

    // Process the action
    const stream = await mockAnthropic.messages.stream({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      system: systemPrompt,
      messages: gameState.messages
    });

    let response = '';
    for await (const message of stream) {
      if (message.type === 'content_block_delta' && message.delta.type === 'text_delta') {
        response += message.delta.text;
      }
    }

    expect(response).toContain('key');
    expect(mockAnthropic.messages.stream).toHaveBeenCalledWith({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      system: systemPrompt,
      messages: gameState.messages
    });
  });
}); 