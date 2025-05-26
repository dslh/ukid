import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import Conversation, { Message } from '@/lib/models/conversation';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    await connectToDatabase();
    
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get all messages for this conversation
    const messages = await Message.find({ conversationId: id });
    
    // Convert messages array to a map for easier access
    const messagesMap: Record<string, any> = {};
    messages.forEach(message => {
      messagesMap[message.messageId] = {
        messageId: message.messageId,
        role: message.role,
        content: message.content,
        parentId: message.parentId,
        children: message.children,
        createdAt: message.createdAt,
      };
    });
    
    // Add messages map to the response
    const response = {
      _id: conversation._id,
      title: conversation.title,
      rootMessageId: conversation.rootMessageId,
      activePath: conversation.activePath,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: messagesMap,
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}