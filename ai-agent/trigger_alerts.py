import requests
import json

URL = "http://localhost:8000/alerts/generate"

def trigger_alerts():
    try:
        response = requests.post(URL)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    trigger_alerts()
