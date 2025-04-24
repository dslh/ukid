import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { connectDB } from './db';
import { GameState } from './models/GameState';
import { systemPrompt } from './utils/prompts';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Routes
app.post('/api/game/start', async (req: Request, res: Response) => {
  try {
    const gameState = await GameState.create({
      messages: [
        {
          role: 'assistant',
          content: 'You are in a room with a locked door. There is a key on a table in the middle of the room. What would you like to do?'
        }
      ]
    });

    res.json({ gameId: gameState._id, message: gameState.messages[0].content });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

app.post('/api/game/:gameId/action', async (req: Request, res: Response) => {
  const { gameId } = req.params;
  const { action } = req.body;

  try {
    const gameState = await GameState.findById(gameId);
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    gameState.messages.push({ role: 'user', content: action });
    await gameState.save();

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';

    const stream = await anthropic.messages.stream({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      system: systemPrompt,
      messages: gameState.messages
    });

    for await (const message of stream) {
      if (message.type === 'content_block_delta' && message.delta.type === 'text_delta') {
        const text = message.delta.text;
        fullResponse += text;
        // Send each chunk as an SSE event
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Store the complete response in game state
    gameState.messages.push({ role: 'assistant', content: fullResponse });
    await gameState.save();

    // Send end of stream
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error processing action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// Connect to MongoDB and start server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}); 