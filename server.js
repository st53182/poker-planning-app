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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const participants = new Map();
const stories = new Map();
const votes = new Map();

function generateEncryptedLink() {
  return crypto.randomBytes(16).toString('hex');
}

function createRoom(name, estimationType, creatorName, creatorCompetence) {
  const roomId = uuidv4();
  const encryptedLink = generateEncryptedLink();
  
  const room = {
    id: roomId,
    name: name,
    estimation_type: estimationType,
    encrypted_link: encryptedLink,
    created_at: new Date(),
    current_story_id: null,
    participants: [],
    stories: []
  };
  
  rooms.set(roomId, room);
  rooms.set(encryptedLink, room);
  
  const participant = {
    id: uuidv4(),
    room_id: roomId,
    name: creatorName,
    competence: creatorCompetence,
    is_admin: true,
    session_id: null,
    joined_at: new Date()
  };
  
  participants.set(participant.id, participant);
  room.participants.push(participant);
  
  return { room, participant };
}

function joinRoom(encryptedLink, name, competence, sessionId) {
  const room = rooms.get(encryptedLink);
  if (!room) {
    throw new Error('Room not found');
  }
  
  let participant = Array.from(participants.values()).find(p => 
    p.room_id === room.id && p.session_id === sessionId
  );
  
  if (!participant) {
    const existingCreator = room.participants.find(p => 
      p.name === name && p.competence === competence && p.is_admin === true
    );
    
    if (existingCreator) {
      existingCreator.session_id = sessionId;
      participant = existingCreator;
    } else {
      // Create new participant
      participant = {
        id: uuidv4(),
        room_id: room.id,
        name: name,
        competence: competence,
        is_admin: false,
        session_id: sessionId,
        joined_at: new Date()
      };
      
      participants.set(participant.id, participant);
      room.participants.push(participant);
    }
  } else {
    participant.name = name;
    participant.competence = competence;
  }
  
  return { room, participant };
}

function createStory(roomId, title, description, participantId) {
  const room = rooms.get(roomId);
  const participant = participants.get(participantId);
  
  if (!room || !participant || participant.room_id !== roomId) {
    throw new Error('Invalid room or participant');
  }
  
  const story = {
    id: uuidv4(),
    room_id: roomId,
    title: title,
    description: description,
    voting_state: 'not_started',
    final_estimate: null,
    created_by: participantId,
    created_at: new Date()
  };
  
  stories.set(story.id, story);
  room.stories.unshift(story);
  
  return story;
}

function getSimilarStories(roomId, voteValue, competence) {
  const room = rooms.get(roomId);
  if (!room) return [];
  
  const roomStories = room.stories.filter(s => s.final_estimate === voteValue);
  
  return roomStories
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(s => ({
      title: s.title,
      points: s.final_estimate,
      competence: competence
    }));
}

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
    res.status(500).json({ error: 'Failed to load API documentation' });
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

app.post('/api/create-room', (req, res) => {
  try {
    const { name, estimation_type, creator_name, creator_competence } = req.body;
    const { room, participant } = createRoom(name, estimation_type, creator_name, creator_competence);
    
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
  
  socket.on('join_room_by_link', (data) => {
    try {
      const { encrypted_link, name, competence, session_id } = data;
      const { room, participant } = joinRoom(encrypted_link, name, competence, session_id);
      
      socket.join(room.id);
      socket.participant_id = participant.id;
      socket.room_id = room.id;
      
      const currentStory = room.current_story_id ? stories.get(room.current_story_id) : null;
      
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
  
  socket.on('create_story', (data) => {
    try {
      const { room_id, title, description, participant_id } = data;
      const story = createStory(room_id, title, description, participant_id);
      
      io.to(room_id).emit('story_created', { story });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('set_current_story', (data) => {
    try {
      const { room_id, story_id, participant_id } = data;
      const room = rooms.get(room_id);
      const participant = participants.get(participant_id);
      
      if (!room || !participant || !participant.is_admin) {
        throw new Error('Unauthorized');
      }
      
      room.current_story_id = story_id;
      const story = stories.get(story_id);
      
      io.to(room_id).emit('current_story_set', { story });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('start_voting', (data) => {
    try {
      const { room_id, story_id, participant_id } = data;
      const participant = participants.get(participant_id);
      const story = stories.get(story_id);
      
      if (!participant || !participant.is_admin || !story) {
        throw new Error('Unauthorized');
      }
      
      story.voting_state = 'voting';
      votes.delete(story_id);
      
      io.to(room_id).emit('voting_started', { story_id });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('submit_vote', (data) => {
    try {
      const { room_id, story_id, points, participant_id } = data;
      const participant = participants.get(participant_id);
      const story = stories.get(story_id);
      
      if (!participant || !story || story.voting_state !== 'voting') {
        throw new Error('Invalid vote');
      }
      
      if (!votes.has(story_id)) {
        votes.set(story_id, new Map());
      }
      
      votes.get(story_id).set(participant_id, {
        participant_id,
        participant_name: participant.name,
        competence: participant.competence,
        points
      });
      
      const room = rooms.get(room_id);
      const voteCount = votes.get(story_id).size;
      const participantCount = room.participants.length;
      
      io.to(room_id).emit('vote_submitted', { vote_count: voteCount, participant_count: participantCount });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('reveal_votes', (data) => {
    try {
      const { room_id, story_id, participant_id } = data;
      const participant = participants.get(participant_id);
      const story = stories.get(story_id);
      
      if (!participant || !participant.is_admin || !story) {
        throw new Error('Unauthorized');
      }
      
      story.voting_state = 'revealed';
      const storyVotes = votes.get(story_id) || new Map();
      const voteArray = Array.from(storyVotes.values());
      
      io.to(room_id).emit('votes_revealed', { story_id, votes: voteArray });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('finalize_estimate', (data) => {
    try {
      const { room_id, story_id, final_estimate, participant_id } = data;
      const participant = participants.get(participant_id);
      const story = stories.get(story_id);
      
      if (!participant || !participant.is_admin || !story) {
        throw new Error('Unauthorized');
      }
      
      story.voting_state = 'completed';
      story.final_estimate = final_estimate;
      
      io.to(room_id).emit('estimate_finalized', { story_id, final_estimate });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('get_similar_stories', (data) => {
    try {
      const { room_id, vote_value, competence } = data;
      const similarStories = getSimilarStories(room_id, vote_value, competence);
      
      socket.emit('similar_stories', { stories: similarStories });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('make_admin', (data) => {
    try {
      const { room_id, target_participant_id, participant_id } = data;
      const participant = participants.get(participant_id);
      const targetParticipant = participants.get(target_participant_id);
      
      if (!participant || !participant.is_admin || !targetParticipant) {
        throw new Error('Unauthorized');
      }
      
      targetParticipant.is_admin = true;
      
      io.to(room_id).emit('admin_promoted', { participant: targetParticipant });
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
