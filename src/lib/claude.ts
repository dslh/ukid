import axios from 'axios';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

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

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-3-7-sonnet-20240620',
      messages,
      max_tokens: 4096,
      stream: true,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      responseType: 'stream',
      signal,
    }
  );

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;
          
          // The stream has ended
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          
          try {
            const json = JSON.parse(data);
            const text = json.delta?.text || '';
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      
      response.data.on('data', (chunk: Buffer) => {
        parser.feed(decoder.decode(chunk));
      });

      response.data.on('end', () => {
        controller.close();
      });

      response.data.on('error', (err: Error) => {
        controller.error(err);
      });
    },
  });

  return stream;
}