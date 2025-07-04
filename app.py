import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, PlanningRoom, Participant, PokerStory, Vote

app = Flask(__name__)
CORS(app)

# БД конфиг
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'super-secret-key')

db.init_app(app)

@app.before_first_request
def create_tables():
    db.create_all()

@app.route("/api/rooms", methods=["POST"])
def create_room():
    data = request.json
    room = PlanningRoom(name=data["name"])
    db.session.add(room)
    db.session.commit()
    return jsonify({"room_id": room.id}), 201

@app.route("/api/rooms/<room_id>/participants", methods=["POST"])
def join_room(room_id):
    data = request.json
    participant = Participant(
        name=data["name"],
        competence=data["competence"],
        room_id=room_id
    )
    db.session.add(participant)
    db.session.commit()
    return jsonify({"participant_id": participant.id}), 201

@app.route("/api/rooms/<room_id>/stories", methods=["POST"])
def add_story(room_id):
    data = request.json
    story = PokerStory(
        title=data["title"],
        description=data.get("description"),
        room_id=room_id
    )
    db.session.add(story)
    db.session.commit()
    return jsonify({"story_id": story.id}), 201

@app.route("/api/rooms/<room_id>/participants", methods=["GET"])
def get_participants(room_id):
    participants = Participant.query.filter_by(room_id=room_id).all()
    return jsonify([{"name": p.name, "competence": p.competence} for p in participants]), 200

@app.route("/")
def index():
    return "Poker Planning API is running 🎉"
