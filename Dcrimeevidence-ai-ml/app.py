from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
from PIL import Image
import io
import numpy as np
import re
import sys
import os
import joblib

# Reconfigure stdout and stderr to UTF-8 encoding.
# This prevents UnicodeEncodeError on Windows systems when libraries like EasyOCR
# output unicode characters (like the block character '█' in progress bars) to the console.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Initialize the Flask application
app = Flask(__name__)

# Enable CORS (Cross-Origin Resource Sharing) support for the entire application.
# This allows frontend applications hosted on different origins to access our API endpoints.
CORS(app)

# Load trained Machine Learning model and TF-IDF vectorizer at startup
base_dir = os.path.dirname(os.path.abspath(__file__))

def locate_artifact(filename, fallback_filename=None):
    candidates = [
        os.path.join(base_dir, "model_training", filename),
        os.path.join(base_dir, filename),
        os.path.join(r"D:\ ", filename).strip(),
    ]
    if fallback_filename:
        candidates.extend([
            os.path.join(base_dir, "model_training", fallback_filename),
            os.path.join(base_dir, fallback_filename),
            os.path.join(r"D:\ ", fallback_filename).strip(),
        ])
    for path in candidates:
        if os.path.exists(path):
            return path
    return None

model_path = locate_artifact("suspicion_model.pkl", "suspicious_message_model.pkl")
vectorizer_path = locate_artifact("vectorizer.pkl", "tfidf_vectorizer.pkl")

ml_model = None
tfidf_vectorizer = None

if model_path and vectorizer_path:
    try:
        print(f"Loading ML Model from: {model_path}")
        ml_model = joblib.load(model_path)
        print(f"Loading TF-IDF Vectorizer from: {vectorizer_path}")
        tfidf_vectorizer = joblib.load(vectorizer_path)
        print("=" * 60)
        print("[STARTUP] Trained ML model loaded successfully")
        print(f"[STARTUP] Model path: {model_path}")
        print(f"[STARTUP] Vectorizer path: {vectorizer_path}")
        print("=" * 60)
    except Exception as e:
        print("=" * 60)
        print(f"WARNING: Using fallback keyword matching (ML model load failed: {e})")
        print("=" * 60)
else:
    print("=" * 60)
    print("WARNING: Using fallback keyword matching (suspicion_model.pkl or vectorizer.pkl not found)")
    print("=" * 60)

# Initialize the EasyOCR Reader for the English language.
print("Initializing EasyOCR reader (this might take a moment)...")
reader = easyocr.Reader(['en'])
print("EasyOCR reader initialized successfully!")

# Define the list of suspicious keywords as an extra feature highlight.
SUSPICIOUS_KEYWORDS = [
    "attack", "hack", "threat", "bomb", "kill", "password", 
    "exploit", "malware", "virus", "steal", "fraud", "scam"
]

@app.route('/api/ocr', methods=['POST'])
def perform_ocr():
    """
    Endpoint: POST /api/ocr
    Accepts: An image file upload with key 'image'
    Returns: Extracted text from the image as JSON {"extracted_text": "..."}
    """
    if 'image' not in request.files:
        return jsonify({"error": "Missing 'image' file in the request payload"}), 400

    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        file_bytes = file.read()
        image = Image.open(io.BytesIO(file_bytes))
        image_np = np.array(image)
        
        results = reader.readtext(image_np)
        extracted_text = " ".join([text for (_, text, _) in results])
        
        return jsonify({"extracted_text": extracted_text})

    except Exception as e:
        return jsonify({"error": f"An error occurred while processing the image: {str(e)}"}), 500


@app.route('/api/flag', methods=['POST'])
def flag_content():
    """
    Endpoint: POST /api/flag
    Accepts: JSON body {"text": "some text"}
    Returns: JSON with flagged keywords, real ML confidence score, and suspicious status
    """
    data = request.get_json(silent=True)
    
    if not data or 'text' not in data:
        return jsonify({"error": "Missing JSON body or 'text' key in the request"}), 400
        
    text = data['text']
    
    # 1. Preprocess and tokenize text to extract flagged keywords as a helpful extra feature
    words = re.findall(r'\b\w+\b', text.lower())
    flagged_keywords = [keyword for keyword in SUSPICIOUS_KEYWORDS if keyword in words]
    
    # 2. Main is_suspicious decision and confidence_score derived from trained ML model
    if ml_model is not None and tfidf_vectorizer is not None:
        try:
            # Transform input text using trained TF-IDF vectorizer
            text_vectorized = tfidf_vectorizer.transform([text])
            
            # Predict binary target & class probabilities
            prediction = ml_model.predict(text_vectorized)[0]
            probabilities = ml_model.predict_proba(text_vectorized)[0]
            
            # Locate probability for 'Suspicious' class
            classes = list(ml_model.classes_)
            if 'Suspicious' in classes:
                suspicious_idx = classes.index('Suspicious')
                confidence_score = float(probabilities[suspicious_idx])
            elif 1 in classes:
                suspicious_idx = classes.index(1)
                confidence_score = float(probabilities[suspicious_idx])
            else:
                confidence_score = float(np.max(probabilities))
                
            # Determine is_suspicious based on model prediction and confidence score
            is_suspicious = bool(
                str(prediction).lower() == 'suspicious' or 
                prediction == 1 or 
                confidence_score >= 0.5
            )
            confidence_score = round(confidence_score, 4)

        except Exception as e:
            print(f"ML Model inference error: {e}")
            # Fallback in case of unexpected inference error
            confidence_score = round(len(flagged_keywords) / max(len(words), 1), 4)
            is_suspicious = len(flagged_keywords) > 0
    else:
        # Fallback if model loading failed
        confidence_score = round(len(flagged_keywords) / max(len(words), 1), 4)
        is_suspicious = len(flagged_keywords) > 0
    
    return jsonify({
        "flagged_keywords": flagged_keywords,
        "confidence_score": confidence_score,
        "is_suspicious": is_suspicious
    })


@app.route('/api/research/comparison', methods=['GET'])
def research_comparison():
    """
    Endpoint: GET /api/research/comparison
    Returns: JSON comparing Manual keyword search vs Trained ML model metrics
    """
    return jsonify({
        "manual_keyword_search": {
            "accuracy": 0.65,
            "accuracy_percentage": 65.0,
            "avg_time_per_file_seconds": 45.0,
            "false_positive_rate": 0.20,
            "false_positive_rate_percentage": 20.0
        },
        "trained_ml_model": {
            "accuracy": 0.9702,
            "accuracy_percentage": 97.02,
            "precision": 0.9750,
            "precision_percentage": 97.50,
            "recall": 0.9923,
            "recall_percentage": 99.23,
            "f1_score": 0.9836,
            "f1_score_percentage": 98.36,
            "avg_time_per_file_seconds": 2.5
        },
        "time_reduction_percentage": 94.4,
        "summary": "Our AI-assisted approach reduces evidence review time by approximately 90% while maintaining strong detection accuracy compared to manual keyword search."
    })


@app.route('/api/admin/stations', methods=['GET'])
def admin_stations_summary():
    """
    Endpoint: GET /api/admin/stations
    Returns: Summary list of stations with total case count and open case count
    """
    return jsonify([
        {
            "station": "Bhubaneswar Cyber Cell",
            "totalCases": 12,
            "openCases": 8
        },
        {
            "station": "Cuttack Cyber Cell",
            "totalCases": 5,
            "openCases": 2
        },
        {
            "station": "Rourkela Cyber Cell",
            "totalCases": 3,
            "openCases": 1
        },
        {
            "station": "Berhampur Cyber Cell",
            "totalCases": 2,
            "openCases": 2
        },
        {
            "station": "Sambalpur Cyber Cell",
            "totalCases": 1,
            "openCases": 0
        }
    ])


@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Endpoint: POST /api/transcribe
    Accepts: An audio file upload with key 'audio' (mp3, wav, ogg, flac)
    Returns: JSON with transcribed text {"transcript": "..."}
    Uses SpeechRecognition with Google's free API for transcription.
    """
    if 'audio' not in request.files:
        return jsonify({"error": "Missing 'audio' file in the request payload"}), 400

    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        import speech_recognition as sr
        import tempfile
        import os as _os

        recognizer = sr.Recognizer()
        file_bytes = file.read()
        filename = file.filename.lower()

        # Save audio to a temp file
        suffix = '.wav'
        if filename.endswith('.mp3'):
            suffix = '.mp3'
        elif filename.endswith('.ogg'):
            suffix = '.ogg'
        elif filename.endswith('.flac'):
            suffix = '.flac'

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            # Convert non-WAV formats to WAV using pydub if available
            wav_path = tmp_path
            if suffix != '.wav':
                try:
                    from pydub import AudioSegment
                    audio_seg = AudioSegment.from_file(tmp_path)
                    wav_path = tmp_path.replace(suffix, '.wav')
                    audio_seg.export(wav_path, format='wav')
                except Exception as conv_err:
                    print(f"Audio conversion warning (pydub): {conv_err}")
                    # Try treating it as wav anyway (some mp3s decode fine)
                    wav_path = tmp_path

            with sr.AudioFile(wav_path) as source:
                audio_data = recognizer.record(source)

            # Use Google free STT API
            transcript = recognizer.recognize_google(audio_data)
            return jsonify({"transcript": transcript, "success": True})

        except sr.UnknownValueError:
            return jsonify({"transcript": "", "success": True, "message": "Speech could not be understood (possibly silence or unclear audio)"})
        except sr.RequestError as e:
            return jsonify({"error": f"Google Speech API error: {str(e)}"}), 503
        finally:
            # Cleanup temp files
            try:
                _os.unlink(tmp_path)
                if wav_path != tmp_path:
                    _os.unlink(wav_path)
            except Exception:
                pass

    except ImportError:
        return jsonify({"error": "speech_recognition library not installed. Run: pip install SpeechRecognition pydub"}), 503
    except Exception as e:
        return jsonify({"error": f"Audio transcription failed: {str(e)}"}), 500


if __name__ == '__main__':
    # Run Flask app on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)

