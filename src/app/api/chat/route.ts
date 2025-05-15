import { NextRequest } from 'next/server';
import { streamClaudeResponse } from '@/lib/claude';
import connectToDatabase from '@/lib/db/mongodb';
import Conversation from '@/lib/models/conversation';

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId } = await req.json();
    
    // Connect to MongoDB
    await connectToDatabase();
    
    // Create or update conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Create a new conversation with the first user message
      const firstUserMessage = messages[messages.length - 1];
      conversation = new Conversation({
        title: firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : ''),
        messages: [firstUserMessage],
      });
      await conversation.save();
    }

    // Set up SSE response
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        // Send the conversation ID first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: conversation._id })}\n\n`));
        
        try {
          // Stream Claude's response
          const stream = await streamClaudeResponse(messages, req.signal);
          const reader = stream.getReader();
          
          let assistantMessage = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            assistantMessage += chunk;
            
            // Send the chunk to the client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          }
          
          // Save the assistant's message to the conversation
          conversation.messages.push({
            role: 'assistant',
            content: assistantMessage,
          });
          await conversation.save();
          
          // Signal the end of the stream
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (error) {
          console.error('Error streaming response:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'An error occurred' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}