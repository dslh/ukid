import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import Conversation from '@/lib/models/conversation';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    const conversations = await Conversation.find({})
      .sort({ updatedAt: -1 })
      .select('_id title updatedAt');
    
    return new Response(JSON.stringify(conversations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { conversationId } = await req.json();
    
    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'Conversation ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    await connectToDatabase();
    
    const result = await Conversation.findByIdAndDelete(conversationId);
    
    if (!result) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}