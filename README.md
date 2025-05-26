# Claude Chat Application

A Next.js web application for chatting with Claude 3.7 Sonnet. This application provides a clean interface for interacting with Claude AI, with conversation history saved to MongoDB and responses streamed in real-time using Server-Sent Events (SSE).

## Features

- Chat with Claude 3.7 Sonnet
- Real-time streaming of responses
- Conversation history saved to MongoDB
- Markdown rendering for Claude's responses
- Responsive UI with Tailwind CSS

## Prerequisites

- Node.js 18.17.0 or later
- MongoDB database (local or Atlas)
- Anthropic API key for Claude

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
MONGODB_URI=your_mongodb_connection_string
ANTHROPIC_API_KEY=your_anthropic_api_key
```
First, install the dependencies:

```bash
npm install
```

Then, run the development server:
```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure
- `src/app/page.tsx`: Main chat interface
- `src/app/conversation/[id]/page.tsx`: Conversation detail page
- `src/app/api/chat/route.ts`: API endpoint for chat with SSE streaming
- `src/app/api/conversations/route.ts`: API endpoints for listing and deleting conversations
- `src/app/api/conversations/[id]/route.ts`: API endpoint for retrieving specific conversations
- `src/components/`: UI components for the chat interface
- `src/lib/claude.ts`: Claude API streaming implementation
- `src/lib/db/mongodb.ts`: MongoDB connection utility
- `src/lib/models/conversation.ts`: Mongoose models for conversations and messages

## Technologies Used
- Next.js 14
- React
- TypeScript
- Tailwind CSS
- MongoDB with Mongoose
- Server-Sent Events (SSE) for streaming
- Anthropic Claude API
