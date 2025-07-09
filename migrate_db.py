#!/usr/bin/env python3

import eventlet
eventlet.monkey_patch()

import os
from socketio_server import app, db

def migrate_database():
    """
    Migration script to update production database schema.
    This will add missing columns to existing tables.
    """
    with app.app_context():
        connection = db.engine.connect()
        
        try:
            print("🔄 Starting database migration...")
            
            try:
                connection.execute("""
                    ALTER TABLE planning_room 
                    ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Unnamed Room'
                """)
                print("✅ Added 'name' column to planning_room")
            except Exception as e:
                print(f"ℹ️  'name' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE planning_room 
                    ADD COLUMN IF NOT EXISTS estimation_type VARCHAR(20) DEFAULT 'story_points'
                """)
                print("✅ Added 'estimation_type' column to planning_room")
            except Exception as e:
                print(f"ℹ️  'estimation_type' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE planning_room 
                    ADD COLUMN IF NOT EXISTS current_story_id INTEGER
                """)
                print("✅ Added 'current_story_id' column to planning_room")
            except Exception as e:
                print(f"ℹ️  'current_story_id' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE participant 
                    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
                """)
                print("✅ Added 'is_admin' column to participant")
            except Exception as e:
                print(f"ℹ️  'is_admin' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE participant 
                    ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)
                """)
                print("✅ Added 'session_id' column to participant")
            except Exception as e:
                print(f"ℹ️  'session_id' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE poker_story 
                    ADD COLUMN IF NOT EXISTS voting_state VARCHAR(20) DEFAULT 'closed'
                """)
                print("✅ Added 'voting_state' column to poker_story")
            except Exception as e:
                print(f"ℹ️  'voting_state' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE poker_story 
                    ADD COLUMN IF NOT EXISTS final_estimate FLOAT
                """)
                print("✅ Added 'final_estimate' column to poker_story")
            except Exception as e:
                print(f"ℹ️  'final_estimate' column may already exist: {e}")
            
            try:
                connection.execute("""
                    ALTER TABLE vote 
                    ADD COLUMN IF NOT EXISTS competence VARCHAR(50) NOT NULL DEFAULT 'FullStack'
                """)
                print("✅ Added 'competence' column to vote")
            except Exception as e:
                print(f"ℹ️  'competence' column may already exist: {e}")
            
            connection.commit()
            print("\n🎉 Database migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            connection.rollback()
            raise
        finally:
            connection.close()

if __name__ == '__main__':
    migrate_database()
