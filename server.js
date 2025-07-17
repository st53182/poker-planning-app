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
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const OpenAI = require('openai');
const { 
  initializeDatabase, 
  createRoom, 
  joinRoom, 
  createStory,
  createBulkStories,
  updateStory,
  deleteStory,
  updateStoryOrder,
  getSimilarStories,
  getStoryVotes,
  submitVote,
  updateStoryVotingState,
  updateStoryFinalEstimate,
  updateRoomCurrentStory,
  makeParticipantAdmin,
  clearStoryVotes,
  getRoomById,
  createUser,
  getUserByEmail,
  getUserById,
  getUserRooms,
  updateUserLastLogin,
  claimRoom,
  deleteRoom,
  updateParticipantAdminStatus,
  removeParticipant
} = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const connectedUsers = new Map();

initializeDatabase()
  .then(() => {
    console.log('Database initialization completed successfully');
  })
  .catch((error) => {
    console.error('CRITICAL: Database initialization failed!', error);
    console.error('Server will continue running but authentication features may not work');
  });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' }
});

const captchaSessions = new Map();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
}


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:link', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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

app.post('/api/bulk-create-stories-image', upload.single('image'), async (req, res) => {
  try {
    const { room_id, participant_id } = req.body;
    
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const base64Image = req.file.buffer.toString('base64');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract user stories/tasks from this image using ONLY the exact text visible. Do NOT modify, rephrase, or add any content. Return a JSON array of objects with 'title' and 'description' fields using the precise wording from the image. Each title should be the exact text (under 100 characters) and each description should be the exact context text (under 500 characters). Return only valid JSON without any markdown formatting."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${req.file.mimetype};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    let stories;
    try {
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      stories = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response.choices[0].message.content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }
    
    if (!Array.isArray(stories)) {
      return res.status(500).json({ error: 'AI response is not an array' });
    }
    
    const createdStories = await createBulkStories(room_id, stories, participant_id);
    
    io.to(room_id).emit('bulk_stories_created', { stories: createdStories });
    
    res.json({ success: true, stories: createdStories });
  } catch (error) {
    console.error('Error in bulk-create-stories-image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bulk-create-stories-text', async (req, res) => {
  try {
    const { room_id, participant_id, text } = req.body;
    
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Extract user stories/tasks from this text using ONLY the exact words provided. Do NOT modify, rephrase, or add any content. Return a JSON array of objects with 'title' and 'description' fields using the precise wording from the input text. Each title should be the exact text (under 100 characters) and each description should be the exact context text (under 500 characters). Return only valid JSON without any markdown formatting:\n\n${text}`
        }
      ],
      max_tokens: 1000
    });

    let stories;
    try {
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      stories = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response.choices[0].message.content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }
    
    if (!Array.isArray(stories)) {
      return res.status(500).json({ error: 'AI response is not an array' });
    }
    
    const createdStories = await createBulkStories(room_id, stories, participant_id);
    
    io.to(room_id).emit('bulk_stories_created', { stories: createdStories });
    
    res.json({ success: true, stories: createdStories });
  } catch (error) {
    console.error('Error in bulk-create-stories-text:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/captcha', (req, res) => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = num1 + num2;
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  captchaSessions.set(sessionId, { answer, expires: Date.now() + 5 * 60 * 1000 });
  
  res.json({
    question: `Сколько будет ${num1} + ${num2}?`,
    sessionId: sessionId
  });
});

app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, captchaAnswer, captchaSessionId } = req.body;
    
    if (!email || !password || !name || !captchaAnswer || !captchaSessionId) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    
    const captchaSession = captchaSessions.get(captchaSessionId);
    if (!captchaSession || captchaSession.expires < Date.now()) {
      return res.status(400).json({ error: 'CAPTCHA истекла. Обновите страницу.' });
    }
    
    if (parseInt(captchaAnswer) !== captchaSession.answer) {
      return res.status(400).json({ error: 'Неверный ответ на CAPTCHA' });
    }
    
    captchaSessions.delete(captchaSessionId);
    
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(email, passwordHash, name);
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token: token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }
    
    await updateUserLastLogin(user.id);
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token: token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await getUserRooms(req.user.userId);
    res.json({ success: true, rooms: rooms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-room', async (req, res) => {
  try {
    const { name, estimation_type, creator_name, creator_competence } = req.body;
    
    let ownerId = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        ownerId = decoded.userId;
      } catch (err) {
        
      }
    }
    
    const { room, participant } = await createRoom(name, estimation_type, creator_name, creator_competence, ownerId);
    
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

app.post('/api/claim-room', authenticateToken, async (req, res) => {
  try {
    const { room_id } = req.body;
    
    console.log('Claim room request:', { room_id, userId: req.user.userId });
    
    if (!room_id) {
      return res.status(400).json({ error: 'ID комнаты обязателен' });
    }
    
    const result = await claimRoom(room_id, req.user.userId);
    console.log('Claim room success:', result);
    res.json({ success: true, message: result.message });
  } catch (error) {
    console.log('Claim room error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/delete-room', authenticateToken, async (req, res) => {
  try {
    const { room_id } = req.body;
    
    if (!room_id) {
      return res.status(400).json({ error: 'ID комнаты обязателен' });
    }
    
    const result = await deleteRoom(room_id, req.user.userId);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_room_by_link', async (data) => {
    try {
      const { encrypted_link, name, competence, session_id, auth_token, from_dashboard } = data;
      
      let userId = null;
      if (auth_token) {
        try {
          const decoded = jwt.verify(auth_token, JWT_SECRET);
          userId = decoded.userId;
        } catch (jwtError) {
          console.log('Invalid JWT token in socket join_room_by_link:', jwtError.message);
        }
      }
      
      const { room, participant } = await joinRoom(encrypted_link, name, competence, session_id, userId);
      
      socket.join(room.id);
      socket.participant_id = participant.id;
      socket.room_id = room.id;
      
      connectedUsers.set(participant.id, socket.id);
      
      if (from_dashboard && userId) {
        const userRooms = await getUserRooms(userId);
        const ownsRoom = userRooms.some(r => r.encrypted_link === encrypted_link);
        
        if (ownsRoom) {
          await updateParticipantAdminStatus(participant.id, true);
          participant.is_admin = true;
        }
      }
      
      const currentStory = room.current_story_id ? room.stories.find(s => s.id === room.current_story_id) : null;
      
      socket.emit('room_joined', {
        room_id: room.id,
        room_name: room.name,
        estimation_type: room.estimation_type,
        owner_id: room.owner_id,
        participant: participant,
        participants: room.participants,
        stories: room.stories,
        current_story: currentStory
      });
      
      socket.to(room.id).emit('participant_joined', {
        participant: participant
      });
      
      const connectedParticipants = [];
      for (const [participantId, socketId] of connectedUsers.entries()) {
        const participantSocket = io.sockets.sockets.get(socketId);
        if (participantSocket && participantSocket.room_id === room.id) {
          connectedParticipants.push(participantId);
        }
      }
      
      io.to(room.id).emit('participants_updated', { 
        connected_participant_ids: connectedParticipants 
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
      
      const room = await getRoomById(room_id);
      if (room.current_story_id) {
        await updateStoryVotingState(room.current_story_id, 'not_started');
        await clearStoryVotes(room.current_story_id);
      }
      
      await updateRoomCurrentStory(room_id, story_id);
      
      io.to(room_id).emit('current_story_set', { story_id });
      io.to(room_id).emit('voting_interrupted', { previous_story_id: room.current_story_id });
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

  socket.on('update_story', async (data) => {
    try {
      const { story_id, title, description, room_id } = data;
      const updatedStory = await updateStory(story_id, title, description);
      io.to(room_id).emit('story_updated', { story: updatedStory });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('delete_story', async (data) => {
    try {
      const { story_id, room_id } = data;
      await deleteStory(story_id);
      io.to(room_id).emit('story_deleted', { story_id });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('reorder_stories', async (data) => {
    try {
      const { room_id, story_orders } = data;
      await updateStoryOrder(room_id, story_orders);
      io.to(room_id).emit('stories_reordered', { story_orders });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('remove_participant', async (data) => {
    try {
      const { room_id, target_participant_id, participant_id } = data;
      
      const result = await removeParticipant(target_participant_id, participant_id);
      
      connectedUsers.delete(target_participant_id);
      
      for (const [socketId, socket] of io.sockets.sockets.entries()) {
        if (socket.participant_id === target_participant_id) {
          socket.emit('participant_removed', { 
            message: 'Вы были удалены из комнаты администратором' 
          });
          socket.disconnect();
          break;
        }
      }
      
      const connectedParticipants = [];
      for (const [participantId, socketId] of connectedUsers.entries()) {
        const participantSocket = io.sockets.sockets.get(socketId);
        if (participantSocket && participantSocket.room_id === room_id) {
          connectedParticipants.push(participantId);
        }
      }
      
      io.to(room_id).emit('participant_removed_by_admin', {
        participant_id: target_participant_id,
        participant_name: result.participant_name
      });
      
      io.to(room_id).emit('participants_updated', { 
        connected_participant_ids: connectedParticipants 
      });
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.participant_id && socket.room_id) {
      connectedUsers.delete(socket.participant_id);
      
      const connectedParticipants = [];
      for (const [participantId, socketId] of connectedUsers.entries()) {
        const participantSocket = io.sockets.sockets.get(socketId);
        if (participantSocket && participantSocket.room_id === socket.room_id) {
          connectedParticipants.push(participantId);
        }
      }
      
      io.to(socket.room_id).emit('participants_updated', { 
        connected_participant_ids: connectedParticipants 
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
