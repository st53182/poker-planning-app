import eventlet
eventlet.monkey_patch()

from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

# 📦 Flask + Vue build folder
app = Flask(
    __name__,
    static_folder=os.path.abspath("backend/static"),

    static_url_path="/"
)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "super-secret-key")
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL", "sqlite:///db.sqlite3")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")


# 📄 Serve Vue SPA
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_vue_app(path):
    # Если путь существует как файл - отдать файл
    file_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    # Иначе всегда возвращаем index.html для обработки Vue
    return send_from_directory(app.static_folder, "index.html")

@app.route("/test")
def test_static():
    return send_from_directory(app.static_folder, "index.html")
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

    vote = Vote(points=points, competence='Frontend', participant_id=1, story_id=1)  # TODO: Replace placeholder IDs
    db.session.add(vote)
    db.session.commit()

    emit('new_vote', {'points': points, 'room': room_id}, room=room_id)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=10000)

