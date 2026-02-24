import requests
import json

URL = "http://localhost:8000/chat"

def test_chat():
    payload = {"message": "What is the stock of Vitamin C?"}
    try:
        response = requests.post(URL, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_chat()
