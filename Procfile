release: python migrate_db.py
web: gunicorn socketio_server:app --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT
