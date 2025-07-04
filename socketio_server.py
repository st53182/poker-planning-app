from flask import Flask
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

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
