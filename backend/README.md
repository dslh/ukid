# Use Key In Door - Backend

A text adventure game backend powered by Claude AI. The game is designed to be impossible to win, while maintaining the illusion that winning is possible.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory with:
```
PORT=3001
ANTHROPIC_API_KEY=your_api_key_here
```

3. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Start a new game
```
POST /api/game/start
```
Response:
```json
{
  "gameId": "random_game_id",
  "message": "Initial game message"
}
```

### Make a move
```
POST /api/game/:gameId/action
```
Request body:
```json
{
  "action": "Your action here"
}
```
Response:
```json
{
  "message": "Game response"
}
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests (when we add them) 