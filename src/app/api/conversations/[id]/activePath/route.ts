import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import Conversation from '@/lib/models/conversation';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const { activePath } = await req.json();
    
    if (!Array.isArray(activePath)) {
      return new Response(JSON.stringify({ error: 'activePath must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    await connectToDatabase();
    
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    conversation.activePath = activePath;
    await conversation.save();
    
    return new Response(JSON.stringify({ success: true, activePath }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating active path:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}