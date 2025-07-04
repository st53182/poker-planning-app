import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")


# 📄 HTML клиент
html_test_page = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SocketIO Test Client</title>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
</head>
<body>
    <h1>SocketIO Test Client</h1>

    <div>
        <label for="room">Room:</label>
        <input type="text" id="room" placeholder="Enter room name" value="test-room">
        <button onclick="joinRoom()">Join Room</button>
    </div>

    <div>
        <label for="vote">Vote:</label>
        <input type="text" id="vote" placeholder="Enter your vote">
        <button onclick="sendVote()">Send Vote</button>
    </div>

    <ul id="messages"></ul>

    <script>
        const socket = io();

        socket.on('connect', () => {
            log('✅ Connected to server');
        });

        socket.on('disconnect', () => {
            log('❌ Disconnected from server');
        });

        socket.on('user_joined', (data) => {
            log(`👤 User joined room: ${data.room}`);
        });

        socket.on('new_vote', (data) => {
            log(`🗳 New vote in room ${data.room}: ${data.vote}`);
        });

        function joinRoom() {
            const room = document.getElementById('room').value;
            socket.emit('join_room', { room });
            log(`📥 Sent join_room for room: ${room}`);
        }

        function sendVote() {
            const room = document.getElementById('room').value;
            const vote = document.getElementById('vote').value;
            socket.emit('vote', { room, vote });
            log(`📤 Sent vote: ${vote} to room: ${room}`);
        }

        function log(message) {
            const li = document.createElement('li');
            li.textContent = message;
            document.getElementById('messages').appendChild(li);
        }
    </script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(html_test_page)

# Событие: клиент подключился
@socketio.on('connect')
def handle_connect():
    print('Client connected')

# Событие: клиент присоединился к комнате
@socketio.on('join_room')
def handle_join(data):
    room = data['room']
    join_room(room)
    emit('user_joined', data, room=room)

# Событие: клиент отправил голос
@socketio.on('vote')
def handle_vote(data):
    room = data['room']
    emit('new_vote', data, room=room)

# Событие: клиент отключился
@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=6000)
