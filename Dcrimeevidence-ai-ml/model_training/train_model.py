import pandas as pd
import numpy as np
import joblib
import pickle
import os
import sys
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report

def train_and_evaluate():
    """
    Script matching crimeevidence.ipynb workflow:
    1. Loads dataset.csv (columns: text/message, label)
    2. Maps label ('Normal' -> 0, 'Suspicious' -> 1)
    3. Splits data into 80% training, 20% testing
    4. Converts text to numbers using TfidfVectorizer
    5. Trains LogisticRegression classifier (C=5, class_weight='balanced', solver='liblinear')
    6. Evaluates model - prints accuracy, precision, recall, and F1-score
    7. Saves trained model and TF-IDF vectorizer as suspicion_model.pkl / suspicious_message_model.pkl
       and vectorizer.pkl / tfidf_vectorizer.pkl
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Locate dataset
    dataset_path = os.path.join(script_dir, 'dataset.csv')
    if not os.path.exists(dataset_path):
        if os.path.exists(os.path.join(script_dir, 'crimeevidence-ai-ml.csv')):
            dataset_path = os.path.join(script_dir, 'crimeevidence-ai-ml.csv')
        elif os.path.exists(r'D:\crimeevidence-ai-ml.csv'):
            dataset_path = r'D:\crimeevidence-ai-ml.csv'
        else:
            raise FileNotFoundError(f"Could not locate dataset in {script_dir} or D:\\")
            
    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    
    # Identify text column
    if 'text' in df.columns:
        text_col = 'text'
    elif 'message' in df.columns:
        text_col = 'message'
    else:
        text_col = df.columns[0]
        
    label_col = 'label' if 'label' in df.columns else df.columns[1]

    print(f"Loaded {len(df)} records. Text column: '{text_col}', Label column: '{label_col}'")
    
    df = df.dropna(subset=[text_col, label_col])
    
    # Target encoding matching crimeevidence.ipynb
    if df[label_col].dtype == object or isinstance(df[label_col].iloc[0], str):
        label_map = {'Normal': 0, 'Suspicious': 1}
        df['target'] = df[label_col].map(label_map).fillna(1).astype(int)
    else:
        df['target'] = df[label_col].astype(int)

    X = df[text_col].astype(str)
    y = df['target']

    # 80/20 Train-Test Split (stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Training samples: {len(X_train)} (80%), Testing samples: {len(X_test)} (20%)")

    # TF-IDF Vectorization matching crimeevidence.ipynb
    print("Fitting TfidfVectorizer...")
    vectorizer = TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        sublinear_tf=True,
        min_df=2,
        max_df=0.98,
        ngram_range=(1, 2),
        max_features=150000
    )
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)
    print(f"TF-IDF matrix shape: {X_train_tfidf.shape}")

    # Logistic Regression training matching crimeevidence.ipynb
    print("Training Logistic Regression classifier...")
    model = LogisticRegression(
        C=5,
        max_iter=2000,
        class_weight="balanced",
        solver="liblinear",
        random_state=42
    )
    model.fit(X_train_tfidf, y_train)
    print("Model training completed successfully!")

    # Evaluation
    y_pred = model.predict(X_test_tfidf)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, pos_label=1)
    rec = recall_score(y_test, y_pred, pos_label=1)
    f1 = f1_score(y_test, y_pred, pos_label=1)

    print("\n" + "="*50)
    print("CRIMEEVIDENCE.IPYNB MODEL EVALUATION METRICS")
    print("="*50)
    print(f"Test Accuracy : {acc:.4f} ({acc*100:.2f}%)")
    print(f"Precision     : {prec:.4f} ({prec*100:.2f}%) [Target: Suspicious (1)]")
    print(f"Recall        : {rec:.4f} ({rec*100:.2f}%) [Target: Suspicious (1)]")
    print(f"F1-score      : {f1:.4f} ({f1*100:.2f}%) [Target: Suspicious (1)]")
    print("="*50)
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Suspicious"], digits=4))

    # Save model and vectorizer artifacts
    model_names = ['suspicion_model.pkl', 'suspicious_message_model.pkl']
    vectorizer_names = ['vectorizer.pkl', 'tfidf_vectorizer.pkl']
    
    parent_dir = os.path.abspath(os.path.join(script_dir, '..'))
    d_root = r'D:\ '[:-1]
    
    target_dirs = [script_dir, parent_dir]
    if os.path.exists(d_root):
        target_dirs.append(d_root)

    for tdir in target_dirs:
        try:
            for mname in model_names:
                joblib.dump(model, os.path.join(tdir, mname))
            for vname in vectorizer_names:
                joblib.dump(vectorizer, os.path.join(tdir, vname))
            print(f"Saved model & vectorizer pickles to: {tdir}")
        except Exception as e:
            print(f"Could not save to {tdir}: {e}")

if __name__ == '__main__':
    train_and_evaluate()
