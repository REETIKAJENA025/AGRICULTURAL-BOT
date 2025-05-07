import os
from dotenv import load_dotenv

load_dotenv()

# API Key
GEMINI_API_KEY = os.getenv("AIzaSyA8A5s_FPll8Yztsmc_5t6dV22BAIad3fU")
LIBRETRANSLATE_API_KEY = ""  # Add your Gemini API key to .env