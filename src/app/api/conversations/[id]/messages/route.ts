import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import Conversation from '@/lib/models/conversation';
import { Message } from '@/lib/models/conversation';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    await connectToDatabase();
    
    // Get all messages for this conversation
    const messages = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
    
    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Add a new message to the conversation
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    const { role, content, parentId } = await req.json();
    
    await connectToDatabase();
    
    // Get the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Create the new message
    const newMessage = new Message({
      role,
      content,
      parentId,
      conversationId,
    });
    
    await newMessage.save();
    
    // If this is the first message, set it as the root
    if (!conversation.rootMessageId) {
      conversation.rootMessageId = newMessage.messageId;
      conversation.activePath = [newMessage.messageId];
      await conversation.save();
    } else if (parentId) {
      // Add this message as a child of the parent
      const parentMessage = await Message.findOne({ messageId: parentId });
      if (parentMessage) {
        parentMessage.children.push(newMessage.messageId);
        await parentMessage.save();
        
        // Update the active path if needed
        if (conversation.activePath.includes(parentId)) {
          // Find the index of the parent in the active path
          const parentIndex = conversation.activePath.indexOf(parentId);
          
          // Truncate the path after the parent and add the new message
          conversation.activePath = [
            ...conversation.activePath.slice(0, parentIndex + 1),
            newMessage.messageId
          ];
          await conversation.save();
        }
      }
    }
    
    return new Response(JSON.stringify(newMessage), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}