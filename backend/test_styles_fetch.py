from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
response = client.get("/styles.css")
print("Status code for /styles.css:", response.status_code)
print("Headers:", response.headers)
print("Content length received:", len(response.content))
try:
    decoded = response.content.decode('utf-8')
    print("Decoded successfully with utf-8!")
except UnicodeDecodeError as e:
    print("UnicodeDecodeError when client tries to decode /styles.css as utf-8:", e)
