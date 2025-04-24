import Anthropic from '@anthropic-ai/sdk';
import { vi } from 'vitest';

export const streamResponse = vi.fn().mockImplementation(() => ({
  [Symbol.asyncIterator]: async function* () {
    yield {
      type: 'content_block_delta',
      delta: {
        type: 'text_delta',
        text: 'Hello, world!'
      }
    };
  }
}));

export class ClaudeService {
  streamResponse = streamResponse;

  constructor(private anthropic: Anthropic) {
    this.anthropic = anthropic;
  }
}