import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify, render_template_string
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "super-secret-key")
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL", "sqlite:///db.sqlite3")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# 📦 Models
class PlanningRoom(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    current_story_id = db.Column(db.Integer, db.ForeignKey('poker_story.id'), nullable=True)
    current_story = db.relationship('PokerStory', foreign_keys=[current_story_id])

    participants = db.relationship('Participant', backref='room', cascade="all, delete-orphan")
    stories = db.relationship('PokerStory', backref='room', cascade="all, delete-orphan")


class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    competence = db.Column(db.String(50), nullable=False)
    room_id = db.Column(db.String(36), db.ForeignKey('planning_room.id'), nullable=False)


class PokerStory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    room_id = db.Column(db.String(36), db.ForeignKey('planning_room.id'), nullable=False)
    votes = db.relationship('Vote', backref='story', cascade="all, delete-orphan")


class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    points = db.Column(db.Float, nullable=False)
    competence = db.Column(db.String(50), nullable=False)
    participant_id = db.Column(db.Integer, db.ForeignKey('participant.id'), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey('poker_story.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


with app.app_context():
    db.create_all()


# 📄 Тестовая HTML страница
@app.route("/")
def index():
    return render_template_string("""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Planning Poker Test</title>
        <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    </head>
    <body>
        <h1>Planning Poker Test</h1>
        <input id="room" placeholder="Room ID" value="test-room">
        <input id="name" placeholder="Your Name">
        <input id="competence" placeholder="Competence (e.g., Frontend)">
        <button onclick="joinRoom()">Join Room</button>
        <br><br>
        <input id="story" placeholder="Story Title">
        <button onclick="createStory()">Create Story</button>
        <br><br>
        <input id="vote" placeholder="Vote (e.g., 5)">
        <button onclick="sendVote()">Send Vote</button>
        <ul id="log"></ul>
        <script>
            const socket = io();

            socket.on('connect', () => log('✅ Connected'));
            socket.on('user_joined', (data) => log(`👤 ${data.name} joined ${data.room}`));
            socket.on('new_vote', (data) => log(`🗳 Vote in ${data.room}: ${data.points}`));

            function joinRoom() {
                const room = document.getElementById('room').value;
                const name = document.getElementById('name').value;
                const competence = document.getElementById('competence').value;
                socket.emit('join_room', {room, name, competence});
            }

            function createStory() {
                const room = document.getElementById('room').value;
                const story = document.getElementById('story').value;
                socket.emit('create_story', {room, title: story});
            }

            function sendVote() {
                const room = document.getElementById('room').value;
                const points = document.getElementById('vote').value;
                socket.emit('vote', {room, points});
            }

            function log(message) {
                const li = document.createElement('li');
                li.textContent = message;
                document.getElementById('log').appendChild(li);
            }
        </script>
    </body>
    </html>
    """)


# 📡 SocketIO Events
@socketio.on('join_room')
def handle_join(data):
    room_id = data['room']
    name = data['name']
    competence = data['competence']

    # Create room if not exists
    room = PlanningRoom.query.get(room_id)
    if not room:
        room = PlanningRoom(id=room_id)
        db.session.add(room)
        db.session.commit()

    participant = Participant(name=name, competence=competence, room_id=room_id)
    db.session.add(participant)
    db.session.commit()

    join_room(room_id)
    emit('user_joined', {'name': name, 'room': room_id}, room=room_id)


@socketio.on('create_story')
def handle_create_story(data):
    room_id = data['room']
    title = data['title']

    story = PokerStory(title=title, room_id=room_id)
    db.session.add(story)
    db.session.commit()

    emit('story_created', {'title': title, 'room': room_id}, room=room_id)


@socketio.on('vote')
def handle_vote(data):
    room_id = data['room']
    points = float(data['points'])

    vote = Vote(points=points, competence='Frontend', participant_id=1, story_id=1)  # Placeholder IDs
    db.session.add(vote)
    db.session.commit()

    emit('new_vote', {'points': points, 'room': room_id}, room=room_id)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=10000)

