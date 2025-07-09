#!/usr/bin/env python3

import eventlet
eventlet.monkey_patch()

from socketio_server import app, db

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")
