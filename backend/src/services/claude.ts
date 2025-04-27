import { Anthropic } from '@anthropic-ai/sdk';
import { systemPrompt } from '../utils/prompts';

export class ClaudeService {
  private anthropic: Anthropic;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
  }

  async streamResponse(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
    return this.anthropic.messages.stream({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 20000,
      system: systemPrompt,
      thinking: {
        type: 'enabled',
        budget_tokens: 16000
      },
      messages: messages.map(({ role, content }) => ({ role, content }))
    });
  }
} 