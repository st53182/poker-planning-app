from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

# Подключение к БД
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Импорт моделей
from models import PlanningRoom, Participant, Vote

# 🎯 Роуты
@app.route("/api/rooms", methods=["POST"])
def create_room():
    data = request.get_json()
    room = PlanningRoom(name=data["name"])
    db.session.add(room)
    db.session.commit()
    return jsonify({"room_id": room.id}), 201

@app.route("/api/rooms/<room_id>/participants", methods=["POST"])
def join_room(room_id):
    data = request.get_json()
    participant = Participant(name=data["name"], role=data["role"], room_id=room_id)
    db.session.add(participant)
    db.session.commit()
    return jsonify({"participant_id": participant.id}), 201

@app.route("/api/rooms/<room_id>/participants", methods=["GET"])
def get_participants(room_id):
    participants = Participant.query.filter_by(room_id=room_id).all()
    return jsonify([{"id": p.id, "name": p.name, "role": p.role} for p in participants])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)