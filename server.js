const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { 
  initializeDatabase, 
  createRoom, 
  joinRoom, 
  createStory, 
  getSimilarStories,
  getStoryVotes,
  submitVote,
  updateStoryVotingState,
  updateStoryFinalEstimate,
  updateRoomCurrentStory,
  makeParticipantAdmin,
  clearStoryVotes,
  getRoomById
} = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

initializeDatabase().catch(console.error);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:link', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

app.get('/api/docs', (req, res) => {
  try {
    const openApiSpec = fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8');
    const spec = yaml.load(openApiSpec);
    res.json(spec);
  } catch (error) {
    res.status(500).json({ error: 'Не удалось загрузить документацию API' });
  }
});

app.get('/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Planning Poker API Documentation</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.25.0/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@3.25.0/swagger-ui-bundle.js"></script>
      <script>
        SwaggerUIBundle({
          url: '/api/docs',
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIBundle.presets.standalone
          ]
        });
      </script>
    </body>
    </html>
  `);
});

app.post('/api/create-room', async (req, res) => {
  try {
    const { name, estimation_type, creator_name, creator_competence } = req.body;
    const { room, participant } = await createRoom(name, estimation_type, creator_name, creator_competence);
    
    res.json({
      success: true,
      room_link: room.encrypted_link,
      room: room,
      participant: participant
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_room_by_link', async (data) => {
    try {
      const { encrypted_link, name, competence, session_id } = data;
      const { room, participant } = await joinRoom(encrypted_link, name, competence, session_id);
      
      socket.join(room.id);
      socket.participant_id = participant.id;
      socket.room_id = room.id;
      
      const currentStory = room.current_story_id ? room.stories.find(s => s.id === room.current_story_id) : null;
      
      socket.emit('room_joined', {
        room_id: room.id,
        room_name: room.name,
        estimation_type: room.estimation_type,
        participant: participant,
        participants: room.participants,
        stories: room.stories,
        current_story: currentStory
      });
      
      socket.to(room.id).emit('participant_joined', {
        participant: participant
      });
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('create_story', async (data) => {
    try {
      const { room_id, title, description, participant_id } = data;
      const story = await createStory(room_id, title, description, participant_id);
      
      io.to(room_id).emit('story_created', { story });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('set_current_story', async (data) => {
    try {
      const { room_id, story_id, participant_id } = data;
      
      await updateRoomCurrentStory(room_id, story_id);
      
      io.to(room_id).emit('current_story_set', { story_id });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('start_voting', async (data) => {
    try {
      const { room_id, story_id, participant_id } = data;
      
      await updateStoryVotingState(story_id, 'voting');
      await clearStoryVotes(story_id);
      
      io.to(room_id).emit('voting_started', { story_id });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('submit_vote', async (data) => {
    try {
      const { room_id, story_id, points, participant_id } = data;
      
      const client = await require('./database').pool.connect();
      try {
        const participantResult = await client.query('SELECT * FROM participants WHERE id = $1', [participant_id]);
        const participant = participantResult.rows[0];
        
        await submitVote(story_id, participant_id, participant.name, participant.competence, points);
        
        const storyVotes = await getStoryVotes(story_id);
        const participantsResult = await client.query('SELECT COUNT(*) FROM participants WHERE room_id = $1', [room_id]);
        const participantCount = parseInt(participantsResult.rows[0].count);
        
        io.to(room_id).emit('vote_submitted', { vote_count: storyVotes.length, participant_count: participantCount });
      } finally {
        client.release();
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('reveal_votes', async (data) => {
    try {
      const { room_id, story_id, participant_id } = data;
      
      await updateStoryVotingState(story_id, 'revealed');
      const storyVotes = await getStoryVotes(story_id);
      
      io.to(room_id).emit('votes_revealed', { story_id, votes: storyVotes });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('finalize_estimate', async (data) => {
    try {
      const { room_id, story_id, final_estimate, participant_id } = data;
      
      await updateStoryFinalEstimate(story_id, final_estimate);
      
      io.to(room_id).emit('estimate_finalized', { story_id, final_estimate });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('get_similar_stories', async (data) => {
    try {
      const { room_id, vote_value, competence } = data;
      const similarStories = await getSimilarStories(room_id, vote_value, competence);
      
      socket.emit('similar_stories', { stories: similarStories });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('make_admin', async (data) => {
    try {
      const { room_id, target_participant_id, participant_id } = data;
      
      await makeParticipantAdmin(target_participant_id);
      
      io.to(room_id).emit('admin_promoted', { participant_id: target_participant_id });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
