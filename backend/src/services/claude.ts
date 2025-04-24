import { Anthropic } from '@anthropic-ai/sdk';
import { systemPrompt } from '../utils/prompts';

export class ClaudeService {
  private anthropic: Anthropic;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async streamResponse(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
    return this.anthropic.messages.stream({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map(({ role, content }) => ({ role, content }))
    });
  }
} 