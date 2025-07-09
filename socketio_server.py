import eventlet
eventlet.monkey_patch()

from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import uuid

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
def catch_all(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        # если файл существует в static, отдать его
        return send_from_directory(app.static_folder, path)
    else:
        # иначе вернуть index.html
        return send_from_directory(app.static_folder, "index.html")

@app.route("/test")
def test_static():
    return send_from_directory(app.static_folder, "index.html")

COMPETENCIES = ['BE', 'FE', 'DB', 'Analyst', 'FullStack', 'QA', 'Architect']
ESTIMATION_TYPES = ['story_points', 'hours']

# 📦 Models
class PlanningRoom(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    estimation_type = db.Column(db.String(20), default="story_points")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    current_story_id = db.Column(db.Integer, db.ForeignKey('poker_story.id'), nullable=True)
    current_story = db.relationship('PokerStory', foreign_keys=[current_story_id])

    participants = db.relationship('Participant', backref='room', cascade="all, delete-orphan")
    stories = db.relationship('PokerStory', foreign_keys='PokerStory.room_id', backref='room', cascade="all, delete-orphan")


class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    competence = db.Column(db.String(50), nullable=False)
    room_id = db.Column(db.String(36), db.ForeignKey('planning_room.id'), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    session_id = db.Column(db.String(100), nullable=True)


class PokerStory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    room_id = db.Column(db.String(36), db.ForeignKey('planning_room.id'), nullable=False)
    voting_state = db.Column(db.String(20), default="closed")
    final_estimate = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
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


def find_similar_tasks(room_id, vote_value, competence, limit=10):
    return db.session.query(Vote, PokerStory).join(PokerStory).filter(
        PokerStory.room_id == room_id,
        Vote.competence == competence,
        Vote.points.between(vote_value * 0.8, vote_value * 1.2),
        PokerStory.voting_state == 'completed'
    ).order_by(Vote.created_at.desc()).limit(limit).all()

# 📡 SocketIO Events
@socketio.on('create_room')
def handle_create_room(data):
    room_id = str(uuid.uuid4())
    room = PlanningRoom(
        id=room_id,
        name=data['name'],
        estimation_type=data.get('estimation_type', 'story_points')
    )
    db.session.add(room)
    db.session.commit()
    emit('room_created', {'room_id': room_id, 'name': data['name']})

@socketio.on('join_room')
def handle_join(data):
    room_id = data['room']
    name = data['name']
    competence = data['competence']
    session_id = data.get('session_id')

    if competence not in COMPETENCIES:
        emit('error', {'message': 'Invalid competence'})
        return

    room = PlanningRoom.query.get(room_id)
    if not room:
        emit('error', {'message': 'Room not found'})
        return

    existing_participant = Participant.query.filter_by(
        room_id=room_id, 
        name=name, 
        competence=competence
    ).first()
    
    if existing_participant:
        existing_participant.session_id = session_id
        participant = existing_participant
    else:
        is_first_participant = Participant.query.filter_by(room_id=room_id).count() == 0
        participant = Participant(
            name=name, 
            competence=competence, 
            room_id=room_id,
            is_admin=is_first_participant,
            session_id=session_id
        )
        db.session.add(participant)
    
    db.session.commit()

    join_room(room_id)
    
    participants = Participant.query.filter_by(room_id=room_id).all()
    stories = PokerStory.query.filter_by(room_id=room_id).all()
    
    emit('room_joined', {
        'room': room_id,
        'room_name': room.name,
        'estimation_type': room.estimation_type,
        'participant': {
            'id': participant.id,
            'name': participant.name,
            'competence': participant.competence,
            'is_admin': participant.is_admin
        },
        'participants': [{
            'id': p.id,
            'name': p.name,
            'competence': p.competence,
            'is_admin': p.is_admin
        } for p in participants],
        'stories': [{
            'id': s.id,
            'title': s.title,
            'description': s.description,
            'voting_state': s.voting_state,
            'final_estimate': s.final_estimate
        } for s in stories],
        'current_story': room.current_story_id
    })
    
    emit('user_joined', {
        'participant': {
            'id': participant.id,
            'name': participant.name,
            'competence': participant.competence,
            'is_admin': participant.is_admin
        }
    }, room=room_id, include_self=False)

@socketio.on('create_story')
def handle_create_story(data):
    room_id = data['room']
    title = data['title']
    description = data.get('description', '')
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id:
        emit('error', {'message': 'Unauthorized'})
        return

    story = PokerStory(
        title=title,
        description=description,
        room_id=room_id
    )
    db.session.add(story)
    db.session.commit()

    emit('story_created', {
        'story': {
            'id': story.id,
            'title': story.title,
            'description': story.description,
            'voting_state': story.voting_state,
            'final_estimate': story.final_estimate
        }
    }, room=room_id)

@socketio.on('set_current_story')
def handle_set_current_story(data):
    room_id = data['room']
    story_id = data['story_id']
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id or not participant.is_admin:
        emit('error', {'message': 'Unauthorized'})
        return

    room = PlanningRoom.query.get(room_id)
    room.current_story_id = story_id
    db.session.commit()

    emit('current_story_changed', {'story_id': story_id}, room=room_id)

@socketio.on('start_voting')
def handle_start_voting(data):
    room_id = data['room']
    story_id = data['story_id']
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id or not participant.is_admin:
        emit('error', {'message': 'Unauthorized'})
        return

    story = PokerStory.query.get(story_id)
    if not story or story.room_id != room_id:
        emit('error', {'message': 'Story not found'})
        return

    Vote.query.filter_by(story_id=story_id).delete()
    story.voting_state = 'closed'
    story.final_estimate = None
    db.session.commit()

    emit('voting_started', {'story_id': story_id}, room=room_id)

@socketio.on('submit_vote')
def handle_submit_vote(data):
    room_id = data['room']
    story_id = data['story_id']
    points = float(data['points'])
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id:
        emit('error', {'message': 'Unauthorized'})
        return

    story = PokerStory.query.get(story_id)
    if not story or story.room_id != room_id:
        emit('error', {'message': 'Story not found'})
        return
    
    if story.voting_state != 'closed':
        emit('error', {'message': 'Voting not active'})
        return

    existing_vote = Vote.query.filter_by(
        story_id=story_id,
        participant_id=participant_id
    ).first()

    if existing_vote:
        existing_vote.points = points
    else:
        vote = Vote(
            points=points,
            competence=participant.competence,
            participant_id=participant_id,
            story_id=story_id
        )
        db.session.add(vote)

    db.session.commit()

    vote_count = Vote.query.filter_by(story_id=story_id).count()
    participant_count = Participant.query.filter_by(room_id=room_id).count()

    emit('vote_submitted', {
        'story_id': story_id,
        'participant_id': participant_id,
        'vote_count': vote_count,
        'participant_count': participant_count
    }, room=room_id)

@socketio.on('reveal_votes')
def handle_reveal_votes(data):
    room_id = data['room']
    story_id = data['story_id']
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id or not participant.is_admin:
        emit('error', {'message': 'Unauthorized'})
        return

    story = PokerStory.query.get(story_id)
    if not story or story.room_id != room_id:
        emit('error', {'message': 'Story not found'})
        return

    story.voting_state = 'open'
    db.session.commit()

    votes = db.session.query(Vote, Participant).join(Participant).filter(
        Vote.story_id == story_id
    ).all()

    emit('votes_revealed', {
        'story_id': story_id,
        'votes': [{
            'participant_name': participant.name,
            'competence': participant.competence,
            'points': vote.points
        } for vote, participant in votes]
    }, room=room_id)

@socketio.on('finalize_estimate')
def handle_finalize_estimate(data):
    room_id = data['room']
    story_id = data['story_id']
    final_estimate = float(data['final_estimate'])
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id or not participant.is_admin:
        emit('error', {'message': 'Unauthorized'})
        return

    story = PokerStory.query.get(story_id)
    if not story or story.room_id != room_id:
        emit('error', {'message': 'Story not found'})
        return

    story.voting_state = 'completed'
    story.final_estimate = final_estimate
    db.session.commit()

    emit('estimate_finalized', {
        'story_id': story_id,
        'final_estimate': final_estimate
    }, room=room_id)

@socketio.on('get_similar_tasks')
def handle_get_similar_tasks(data):
    room_id = data['room']
    vote_value = float(data['vote_value'])
    competence = data['competence']

    similar_tasks = find_similar_tasks(room_id, vote_value, competence)
    
    emit('similar_tasks', {
        'vote_value': vote_value,
        'competence': competence,
        'tasks': [{
            'title': story.title,
            'points': vote.points,
            'created_at': vote.created_at.isoformat()
        } for vote, story in similar_tasks]
    })

@socketio.on('make_admin')
def handle_make_admin(data):
    room_id = data['room']
    target_participant_id = data['target_participant_id']
    participant_id = data['participant_id']

    participant = Participant.query.get(participant_id)
    if not participant or participant.room_id != room_id or not participant.is_admin:
        emit('error', {'message': 'Unauthorized'})
        return

    target_participant = Participant.query.get(target_participant_id)
    if not target_participant or target_participant.room_id != room_id:
        emit('error', {'message': 'Target participant not found'})
        return

    target_participant.is_admin = True
    db.session.commit()

    emit('admin_added', {
        'participant': {
            'id': target_participant.id,
            'name': target_participant.name,
            'competence': target_participant.competence,
            'is_admin': target_participant.is_admin
        }
    }, room=room_id)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=10000)

