import { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper,
  ThemeProvider,
  CssBaseline
} from '@mui/material';
import { theme } from './theme';

interface GameState {
  gameId: string | null;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

function App() {
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    messages: []
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startNewGame();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [gameState.messages, currentResponse]);

  const startNewGame = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/game/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setGameState({
        gameId: data.gameId,
        messages: [{ role: 'assistant', content: data.message }]
      });
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameState.gameId || !input.trim()) return;

    setLoading(true);
    setCurrentResponse('');
    setInput('');
    
    // Add user message immediately
    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: input }]
    }));

    try {
      const response = await fetch(`http://localhost:3001/api/game/${gameState.gameId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: input })
      });

      if (!response.ok) {
        throw new Error('Failed to submit action');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setGameState(prev => ({
                ...prev,
                messages: [...prev.messages, { role: 'assistant', content: fullResponse }]
              }));
              setCurrentResponse('');
              setLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullResponse += parsed.text;
                setCurrentResponse(prev => prev + parsed.text);
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }

      setInput('');
    } catch (error) {
      console.error('Failed to submit action:', error);
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h1" align="center" gutterBottom>
          Use Key In Door
        </Typography>
        
        <Paper 
          ref={chatContainerRef}
          elevation={3} 
          sx={{ 
            p: 3, 
            mb: 3, 
            height: '60vh', 
            overflow: 'auto',
            backgroundColor: 'background.paper'
          }}
        >
          {gameState.messages.map((message, index) => (
            <Box 
              key={index} 
              sx={{ 
                mb: 2,
                textAlign: message.role === 'user' ? 'right' : 'left'
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  display: 'inline-block',
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                  color: 'white'
                }}
              >
                {message.content}
              </Typography>
            </Box>
          ))}
          {currentResponse && (
            <Box sx={{ mb: 2, textAlign: 'left' }}>
              <Typography
                variant="body1"
                sx={{
                  display: 'inline-block',
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'secondary.main',
                  color: 'white'
                }}
              >
                {currentResponse}
              </Typography>
            </Box>
          )}
        </Paper>

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What would you like to do?"
              disabled={loading}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? 'Thinking...' : 'Submit'}
            </Button>
          </Box>
        </form>
      </Container>
    </ThemeProvider>
  );
}

export default App;
