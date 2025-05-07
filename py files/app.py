# app.py
from flask import Flask, request, jsonify, send_from_directory
from gemini_api import get_gemini_response

app = Flask(__name__, static_folder='static')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    query = data.get('query')
    region = data.get('region')
    language = data.get('language', 'en')  # Default to English
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    try:
        response = get_gemini_response(query, region, language)
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': f'Failed to get response: {str(e)}'}), 500

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)