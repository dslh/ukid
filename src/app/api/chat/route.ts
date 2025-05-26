import { NextRequest } from 'next/server';
import { streamClaudeResponse } from '@/lib/claude';
import connectToDatabase from '@/lib/db/mongodb';
import Conversation, { Message } from '@/lib/models/conversation';
import { buildConversationHistory } from '@/lib/conversationTree';

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId, parentMessageId, isReroll } = await req.json();
    
    // Connect to MongoDB
    await connectToDatabase();
    
    // Create or update conversation
    let conversation;
    let userMessage;
    let userMessageId;
    
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Get the last user message from the messages array
      const lastUserMessage = messages[messages.length - 1];
      
      // If this is a reroll, we need to find the parent of the message being rerolled
      if (isReroll && parentMessageId) {
        // Find the parent message
        const parentMessage = await Message.findOne({ messageId: parentMessageId });
        if (!parentMessage) {
          return new Response(JSON.stringify({ error: 'Parent message not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // The parent of the assistant message is the user message
        userMessageId = parentMessage.messageId;
      } else {
        // Create a new user message
        userMessage = new Message({
          role: 'user',
          content: lastUserMessage.content,
          parentId: parentMessageId || null,
          conversationId: conversation._id,
        });
        
        await userMessage.save();
        userMessageId = userMessage.messageId;
        
        // If this is a new branch from an existing message, add it as a child
        if (parentMessageId) {
          const parentMessage = await Message.findOne({ messageId: parentMessageId });
          if (parentMessage) {
            parentMessage.children.push(userMessage.messageId);
            await parentMessage.save();
          }
        }
        
        // If this is the first message in the conversation, set it as the root
        if (!conversation.rootMessageId) {
          conversation.rootMessageId = userMessage.messageId;
        }
        
        // Update the active path to include this new message
        if (parentMessageId && conversation.activePath.includes(parentMessageId)) {
          const parentIndex = conversation.activePath.indexOf(parentMessageId);
          conversation.activePath = [
            ...conversation.activePath.slice(0, parentIndex + 1),
            userMessage.messageId
          ];
        } else if (!parentMessageId && !conversation.activePath.length) {
          conversation.activePath = [userMessage.messageId];
        }
        
        await conversation.save();
      }
    } else {
      // Create a new conversation with the first user message
      const firstUserMessage = messages[messages.length - 1];
      
      // Create the user message
      userMessage = new Message({
        role: 'user',
        content: firstUserMessage.content,
        parentId: null,
      });
      
      // Create the conversation
      conversation = new Conversation({
        title: firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : ''),
        rootMessageId: null,
        activePath: [],
      });
      
      // Save the conversation first to get an ID
      await conversation.save();
      
      // Set the conversation ID on the message
      userMessage.conversationId = conversation._id;
      await userMessage.save();
      
      // Update the conversation with the root message ID
      conversation.rootMessageId = userMessage.messageId;
      conversation.activePath = [userMessage.messageId];
      await conversation.save();
      
      userMessageId = userMessage.messageId;
    }

    // Set up SSE response
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        // Send the conversation ID and user message ID first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          conversationId: conversation._id,
          userMessageId
        })}\n\n`));
        
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
          const newAssistantMessage = new Message({
            role: 'assistant',
            content: assistantMessage,
            parentId: userMessageId,
            conversationId: conversation._id,
          });
          
          await newAssistantMessage.save();
          
          // Add the assistant message as a child of the user message
          const userMessageDoc = await Message.findOne({ messageId: userMessageId });
          if (userMessageDoc) {
            userMessageDoc.children.push(newAssistantMessage.messageId);
            await userMessageDoc.save();
          }
          
          // Update the active path to include this new assistant message
          if (conversation.activePath.includes(userMessageId)) {
            const userIndex = conversation.activePath.indexOf(userMessageId);
            conversation.activePath = [
              ...conversation.activePath.slice(0, userIndex + 1),
              newAssistantMessage.messageId
            ];
            await conversation.save();
          }
          
          // Signal the end of the stream with the message ID
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            done: true, 
            messageId: newAssistantMessage.messageId,
            activePath: conversation.activePath
          })}\n\n`));
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