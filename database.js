const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  console.log('Starting database initialization...');
  
  let client;
  try {
    client = await pool.connect();
    console.log('Database connection established successfully');
    
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);
    console.log('Users table created successfully');
    
    console.log('Creating rooms table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        estimation_type VARCHAR(50) NOT NULL,
        encrypted_link VARCHAR(32) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        current_story_id UUID,
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('Rooms table created successfully');
    
    console.log('Checking for missing columns in existing tables...');
    
    const roomsColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' AND column_name = 'owner_id';
    `);
    
    if (roomsColumnsResult.rows.length === 0) {
      console.log('Adding missing owner_id column to rooms table...');
      await client.query(`
        ALTER TABLE rooms ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
      `);
      console.log('Added owner_id column to rooms table successfully');
    } else {
      console.log('owner_id column already exists in rooms table');
    }
    
    console.log('Creating participants table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id UUID PRIMARY KEY,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        competence VARCHAR(50) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        session_id VARCHAR(255),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Participants table created successfully');
    
    const participantsColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'participants' AND column_name = 'user_id';
    `);
    
    if (participantsColumnsResult.rows.length === 0) {
      console.log('Adding missing user_id column to participants table...');
      await client.query(`
        ALTER TABLE participants ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      `);
      console.log('Added user_id column to participants table successfully');
    } else {
      console.log('user_id column already exists in participants table');
    }
    
    console.log('Creating stories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        voting_state VARCHAR(50) DEFAULT 'not_started',
        final_estimate VARCHAR(50),
        created_by UUID REFERENCES participants(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Stories table created successfully');
    
    console.log('Checking for missing columns in stories table...');
    const storiesColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stories' AND column_name = 'order_position';
    `);
    
    if (storiesColumnsResult.rows.length === 0) {
      console.log('Adding missing order_position column to stories table...');
      await client.query(`
        ALTER TABLE stories ADD COLUMN order_position INTEGER DEFAULT 0;
      `);
      
      console.log('Updating existing stories with order_position based on created_at...');
      await client.query(`
        UPDATE stories SET order_position = subquery.row_num
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at DESC) as row_num
          FROM stories
        ) AS subquery
        WHERE stories.id = subquery.id;
      `);
      console.log('Added order_position column to stories table successfully');
    } else {
      console.log('order_position column already exists in stories table');
    }
    
    console.log('Creating votes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY,
        story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
        participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
        participant_name VARCHAR(255) NOT NULL,
        competence VARCHAR(50) NOT NULL,
        points VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(story_id, participant_id)
      );
    `);
    console.log('Votes table created successfully');
    
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_rooms_encrypted_link ON rooms(encrypted_link);
      CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
      CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
      CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_stories_room_id ON stories(room_id);
      CREATE INDEX IF NOT EXISTS idx_votes_story_id ON votes(story_id);
    `);
    console.log('Indexes created successfully');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'rooms', 'participants', 'stories', 'votes')
      ORDER BY table_name;
    `);
    
    const tableNames = result.rows.map(row => row.table_name);
    console.log('Verified tables exist:', tableNames);
    
    if (tableNames.length !== 5) {
      throw new Error(`Expected 5 tables, but found ${tableNames.length}: ${tableNames.join(', ')}`);
    }
    
    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint
    });
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function createRoom(name, estimationType, creatorName, creatorCompetence, ownerId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const roomId = require('uuid').v4();
    const encryptedLink = require('crypto').randomBytes(16).toString('hex');
    
    await client.query(
      'INSERT INTO rooms (id, name, estimation_type, encrypted_link, owner_id) VALUES ($1, $2, $3, $4, $5)',
      [roomId, name, estimationType, encryptedLink, ownerId]
    );
    
    const participantId = require('uuid').v4();
    await client.query(
      'INSERT INTO participants (id, room_id, name, competence, is_admin, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [participantId, roomId, creatorName, creatorCompetence, true, ownerId]
    );
    
    await client.query('COMMIT');
    
    const room = {
      id: roomId,
      name: name,
      estimation_type: estimationType,
      encrypted_link: encryptedLink,
      created_at: new Date(),
      current_story_id: null,
      owner_id: ownerId,
      participants: [],
      stories: []
    };
    
    const participant = {
      id: participantId,
      room_id: roomId,
      name: creatorName,
      competence: creatorCompetence,
      is_admin: true,
      session_id: null,
      user_id: ownerId,
      joined_at: new Date()
    };
    
    room.participants.push(participant);
    
    return { room, participant };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function joinRoom(encryptedLink, name, competence, sessionId, userId = null) {
  const client = await pool.connect();
  try {
    const roomResult = await client.query(
      'SELECT * FROM rooms WHERE encrypted_link = $1',
      [encryptedLink]
    );
    
    if (roomResult.rows.length === 0) {
      throw new Error('Комната не найдена');
    }
    
    const room = roomResult.rows[0];
    
    let participantResult = await client.query(
      'SELECT * FROM participants WHERE room_id = $1 AND session_id = $2',
      [room.id, sessionId]
    );
    
    let participant;
    
    if (participantResult.rows.length === 0) {
      const existingCreatorResult = await client.query(
        'SELECT * FROM participants WHERE room_id = $1 AND name = $2 AND competence = $3 AND is_admin = true',
        [room.id, name, competence]
      );
      
      if (existingCreatorResult.rows.length > 0) {
        await client.query(
          'UPDATE participants SET session_id = $1, user_id = $2 WHERE id = $3',
          [sessionId, userId, existingCreatorResult.rows[0].id]
        );
        participant = existingCreatorResult.rows[0];
        participant.session_id = sessionId;
        participant.user_id = userId;
      } else {
        const participantId = require('uuid').v4();
        await client.query(
          'INSERT INTO participants (id, room_id, name, competence, is_admin, session_id, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [participantId, room.id, name, competence, false, sessionId, userId]
        );
        
        participant = {
          id: participantId,
          room_id: room.id,
          name: name,
          competence: competence,
          is_admin: false,
          session_id: sessionId,
          user_id: userId,
          joined_at: new Date()
        };
      }
    } else {
      participant = participantResult.rows[0];
      await client.query(
        'UPDATE participants SET name = $1, competence = $2, user_id = $3 WHERE id = $4',
        [name, competence, userId, participant.id]
      );
      participant.name = name;
      participant.competence = competence;
      participant.user_id = userId;
    }
    
    const participantsResult = await client.query(
      'SELECT * FROM participants WHERE room_id = $1 ORDER BY joined_at',
      [room.id]
    );
    
    const storiesResult = await client.query(
      'SELECT * FROM stories WHERE room_id = $1 ORDER BY order_position ASC',
      [room.id]
    );
    
    room.participants = participantsResult.rows;
    room.stories = storiesResult.rows;
    
    return { room, participant };
  } finally {
    client.release();
  }
}

async function getRoomById(roomId) {
  const client = await pool.connect();
  try {
    const roomResult = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (roomResult.rows.length === 0) {
      throw new Error('Комната не найдена');
    }
    
    const room = roomResult.rows[0];
    
    const participantsResult = await client.query(
      'SELECT * FROM participants WHERE room_id = $1 ORDER BY joined_at',
      [roomId]
    );
    
    const storiesResult = await client.query(
      'SELECT * FROM stories WHERE room_id = $1 ORDER BY order_position ASC',
      [roomId]
    );
    
    room.participants = participantsResult.rows;
    room.stories = storiesResult.rows;
    
    return room;
  } finally {
    client.release();
  }
}

async function createStory(roomId, title, description, participantId) {
  const client = await pool.connect();
  try {
    const roomResult = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    const participantResult = await client.query('SELECT * FROM participants WHERE id = $1', [participantId]);
    
    if (roomResult.rows.length === 0 || participantResult.rows.length === 0 || 
        participantResult.rows[0].room_id !== roomId) {
      throw new Error('Неверная комната или участник');
    }
    
    const orderPositionResult = await client.query(
      'SELECT COALESCE(MAX(order_position), 0) + 1 as next_position FROM stories WHERE room_id = $1',
      [roomId]
    );
    const orderPosition = orderPositionResult.rows[0].next_position;
    
    const storyId = require('uuid').v4();
    await client.query(
      'INSERT INTO stories (id, room_id, title, description, created_by, order_position) VALUES ($1, $2, $3, $4, $5, $6)',
      [storyId, roomId, title, description, participantId, orderPosition]
    );
    
    await enforceStoryLimit(client, roomId);
    
    const story = {
      id: storyId,
      room_id: roomId,
      title: title,
      description: description,
      voting_state: 'not_started',
      final_estimate: null,
      created_by: participantId,
      created_at: new Date(),
      order_position: orderPosition
    };
    
    return story;
  } finally {
    client.release();
  }
}

async function getSimilarStories(roomId, voteValue, competence) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT title, final_estimate FROM stories WHERE room_id = $1 AND final_estimate = $2 ORDER BY created_at DESC LIMIT 10',
      [roomId, voteValue]
    );
    
    return result.rows.map(s => ({
      title: s.title,
      points: s.final_estimate,
      competence: competence
    }));
  } finally {
    client.release();
  }
}

async function getStoryVotes(storyId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM votes WHERE story_id = $1',
      [storyId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function submitVote(storyId, participantId, participantName, competence, points) {
  const client = await pool.connect();
  try {
    const voteId = require('uuid').v4();
    await client.query(
      'INSERT INTO votes (id, story_id, participant_id, participant_name, competence, points) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (story_id, participant_id) DO UPDATE SET participant_name = $4, competence = $5, points = $6',
      [voteId, storyId, participantId, participantName, competence, points]
    );
  } finally {
    client.release();
  }
}

async function updateStoryVotingState(storyId, votingState) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE stories SET voting_state = $1 WHERE id = $2',
      [votingState, storyId]
    );
  } finally {
    client.release();
  }
}

async function updateStoryFinalEstimate(storyId, finalEstimate) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE stories SET voting_state = $1, final_estimate = $2 WHERE id = $3',
      ['completed', finalEstimate, storyId]
    );
  } finally {
    client.release();
  }
}

async function updateRoomCurrentStory(roomId, storyId) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE rooms SET current_story_id = $1 WHERE id = $2',
      [storyId, roomId]
    );
  } finally {
    client.release();
  }
}

async function makeParticipantAdmin(participantId) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE participants SET is_admin = true WHERE id = $1',
      [participantId]
    );
  } finally {
    client.release();
  }
}

async function claimRoom(roomId, userId) {
  const client = await pool.connect();
  try {
    console.log('claimRoom called with:', { roomId, userId });
    
    const roomResult = await client.query(
      'SELECT id, owner_id FROM rooms WHERE id = $1',
      [roomId]
    );
    
    console.log('Room query result:', roomResult.rows);
    
    if (roomResult.rows.length === 0) {
      throw new Error('Комната не найдена');
    }
    
    const room = roomResult.rows[0];
    if (room.owner_id !== null) {
      throw new Error('Комната уже принадлежит другому пользователю');
    }
    
    const allParticipantsResult = await client.query(
      'SELECT id, name, competence, is_admin, user_id FROM participants WHERE room_id = $1',
      [roomId]
    );
    console.log('All participants in room:', allParticipantsResult.rows);
    
    const participantResult = await client.query(
      'SELECT id, is_admin FROM participants WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    
    console.log('Participant query result:', participantResult.rows);
    
    if (participantResult.rows.length === 0) {
      throw new Error('Вы не являетесь участником этой комнаты');
    }
    
    const participant = participantResult.rows[0];
    
    await client.query(
      'UPDATE rooms SET owner_id = $1 WHERE id = $2',
      [userId, roomId]
    );
    
    console.log('Room claimed successfully');
    return { success: true, message: 'Комната успешно присвоена' };
  } finally {
    client.release();
  }
}

async function clearStoryVotes(storyId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM votes WHERE story_id = $1', [storyId]);
  } finally {
    client.release();
  }
}

async function createUser(email, passwordHash, name) {
  const client = await pool.connect();
  try {
    const userId = require('uuid').v4();
    await client.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
      [userId, email, passwordHash, name]
    );
    
    return {
      id: userId,
      email: email,
      name: name,
      created_at: new Date()
    };
  } finally {
    client.release();
  }
}

async function getUserByEmail(email) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getUserById(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, email, name, created_at, last_login FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getUserRooms(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, estimation_type, encrypted_link, created_at FROM rooms WHERE owner_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function updateUserLastLogin(userId) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  } finally {
    client.release();
  }
}

async function createBulkStories(roomId, stories, participantId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const createdStories = [];
    
    for (let i = 0; i < stories.length; i++) {
      const orderPositionResult = await client.query(
        'SELECT COALESCE(MAX(order_position), 0) + 1 as next_position FROM stories WHERE room_id = $1',
        [roomId]
      );
      const orderPosition = orderPositionResult.rows[0].next_position;
      
      const story = {
        id: require('uuid').v4(),
        room_id: roomId,
        title: stories[i].title,
        description: stories[i].description || '',
        voting_state: 'not_started',
        final_estimate: null,
        created_by: participantId,
        created_at: new Date(),
        order_position: orderPosition
      };
      
      await client.query(
        'INSERT INTO stories (id, room_id, title, description, voting_state, final_estimate, created_by, created_at, order_position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [story.id, story.room_id, story.title, story.description, story.voting_state, story.final_estimate, story.created_by, story.created_at, story.order_position]
      );
      
      createdStories.push(story);
    }
    
    await enforceStoryLimit(client, roomId);
    await client.query('COMMIT');
    return createdStories;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateStory(storyId, title, description) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE stories SET title = $1, description = $2 WHERE id = $3',
      [title, description, storyId]
    );
    
    const result = await client.query(
      'SELECT * FROM stories WHERE id = $1',
      [storyId]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteStory(storyId) {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM stories WHERE id = $1 RETURNING room_id', [storyId]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateStoryOrder(roomId, storyOrders) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { storyId, orderPosition } of storyOrders) {
      await client.query(
        'UPDATE stories SET order_position = $1 WHERE id = $2 AND room_id = $3',
        [orderPosition, storyId, roomId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function enforceStoryLimit(client, roomId) {
  const result = await client.query(
    'SELECT id FROM stories WHERE room_id = $1 ORDER BY order_position DESC OFFSET 100',
    [roomId]
  );
  
  if (result.rows.length > 0) {
    const storyIds = result.rows.map(row => row.id);
    await client.query(
      'DELETE FROM stories WHERE id = ANY($1)',
      [storyIds]
    );
  }
}

async function deleteRoom(roomId, userId) {
  const client = await pool.connect();
  try {
    const participantResult = await client.query(
      'SELECT is_admin FROM participants WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    
    if (participantResult.rows.length === 0 || !participantResult.rows[0].is_admin) {
      throw new Error('Только администраторы могут удалить комнату');
    }
    
    await client.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    
    return { success: true, message: 'Комната успешно удалена' };
  } finally {
    client.release();
  }
}

module.exports = { 
  pool, 
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
  deleteRoom
};
