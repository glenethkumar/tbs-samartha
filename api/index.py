import sys
import os

# Include backend path for Vercel Serverless execution
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.main import app
