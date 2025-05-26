import Anthropic from '@anthropic-ai/sdk';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamClaudeResponse(
  messages: Message[],
  signal: AbortSignal
): Promise<ReadableStream> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not defined');
  }

  const anthropic = new Anthropic({
    apiKey,
  });

  const stream = await anthropic.messages.stream({
    model: 'claude-3-sonnet-20240229',
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    max_tokens: 4096,
  }, {
    signal,
  });

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && 'text' in chunk.delta) {
            const text = chunk.delta.text;
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        if (signal.aborted) {
          controller.close();
        } else {
          controller.error(error);
        }
      }
    },
  });
}