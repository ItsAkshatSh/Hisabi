from flask import Flask, request, jsonify, send_from_directory, g
import requests
import os
import sqlite3
from datetime import datetime
import json
from werkzeug.security import generate_password_hash, check_password_hash
import google.oauth2.id_token
import google.auth.transport.requests
from mindee import ClientV2, InferencePredictOptions
import tempfile
import traceback


app = Flask(__name__, static_folder='static')
app.secret_key = 'supersecretkey'  


MINDEE_API_KEY = "API KEY"
MINDEE_MODEL_ID = "HI_BUDDY"
DATABASE = 'receipts.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
        try:
            db.execute('ALTER TABLE receipts ADD COLUMN saved_at DATETIME DEFAULT CURRENT_TIMESTAMP')
        except sqlite3.OperationalError:
            pass
        db.commit()

init_db()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'receipt' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['receipt']
  
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        file.save(tmp.name)
        temp_path = tmp.name

    # Mindee SDK logic
    mindee_client = ClientV2(MINDEE_API_KEY)
    options = InferencePredictOptions(
        model_id=MINDEE_MODEL_ID,
        rag=False,
    )
    input_doc = mindee_client.source_from_path(temp_path)
    try:
        response = mindee_client.enqueue_and_parse(input_doc, options)
        print("MINDEE RESPONSE DIR:", dir(response))
        print("MINDEE RESPONSE:", response)
        print("MINDEE INFERENCE DIR:", dir(response.inference))
        print("MINDEE INFERENCE:", response.inference)
        print("MINDEE RAW HTTP:", response.raw_http)
        data = response.raw_http  
        print("MINDEE RAW RESPONSE:", data)
        import json
        if isinstance(data, str):
            data = json.loads(data)
        try:
            line_items = data["inference"]["result"]["fields"]["line_items"]["items"]
            items = []
            for item in line_items:
                fields = item["fields"]
                items.append({
                    "name": fields["description"]["value"],
                    "quantity": fields["quantity"]["value"],
                    "price": fields["unit_price"]["value"],
                    "total": fields["total_price"]["value"]
                })
            return jsonify({"items": items, "mindeeRaw": data})
        except Exception as e:
            print("EXTRACTION ERROR:", e)
            traceback.print_exc()
            return jsonify({'error': 'Failed to extract line items', 'details': str(e), 'mindeeRaw': data}), 500
    except Exception as e:
        print("UPLOAD ERROR:", e)
        traceback.print_exc()
        return jsonify({'error': 'Failed to parse Mindee response', 'details': str(e)}), 500
    finally:
        # Clean up the temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.route('/api/save_receipt', methods=['POST'])
def save_receipt():
    content = request.get_json()
    name = content.get('name')
    data = content.get('data')
    if not name or not data:
        return jsonify({'error': 'Name and data are required.'}), 400
    db = get_db()
    now = datetime.now().isoformat(sep=' ', timespec='seconds')
    db.execute('INSERT INTO receipts (name, data, saved_at) VALUES (?, ?, ?)', (name, json.dumps(data), now))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/receipts', methods=['GET'])
def list_receipts():
    db = get_db()
    cur = db.execute('SELECT id, name, saved_at FROM receipts ORDER BY saved_at DESC, id DESC')
    receipts = [{'id': row['id'], 'name': row['name'], 'saved_at': row['saved_at']} for row in cur.fetchall()]
    return jsonify({'receipts': receipts})

@app.route('/api/receipt/<int:receipt_id>', methods=['GET'])
def get_receipt(receipt_id):
    db = get_db()
    cur = db.execute('SELECT id, name, data, saved_at FROM receipts WHERE id = ?', (receipt_id,))
    row = cur.fetchone()
    if row:
        return jsonify({'id': row['id'], 'name': row['name'], 'data': row['data'], 'saved_at': row['saved_at']})
    else:
        return jsonify({'error': 'Receipt not found'}), 404


@app.route('/api/debug/receipts', methods=['GET'])
def debug_receipts():
    db = get_db()
    cur = db.execute('SELECT id, name, saved_at FROM receipts ORDER BY id')
    receipts = [{'id': row['id'], 'name': row['name'], 'saved_at': row['saved_at']} for row in cur.fetchall()]
    return jsonify({'receipts': receipts})

if __name__ == '__main__':
    app.run(debug=True) 
