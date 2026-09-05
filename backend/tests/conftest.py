"""Shared pytest fixtures.

The test suite runs the *real* FastAPI app end-to-end (routing, auth,
validation, service orchestration) but swaps two things for fakes so tests
don't need a live MongoDB cluster or real AI provider keys:

1. `app.db.mongodb.database` -> an in-memory fake with the handful of
   PyMongo async methods the app actually uses.
2. The AI service functions imported into `journal_service` -> deterministic
   fakes, so tests are fast and don't burn API quota.
"""
import os
from datetime import datetime

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    def __init__(self):
        self.docs: dict = {}

    async def create_index(self, *a, **k):
        return "ok"

    async def find_one(self, query):
        for d in self.docs.values():
            if all(d.get(k) == v for k, v in query.items()):
                return d
        return None

    async def insert_one(self, doc):
        _id = doc.get("_id") or ObjectId()
        doc["_id"] = _id
        self.docs[_id] = doc

        class Result:
            inserted_id = _id

        return Result()

    def find(self, query=None):
        query = query or {}
        results = [d for d in self.docs.values() if all(d.get(k) == v for k, v in query.items())]
        results.sort(key=lambda d: d.get("created_at", datetime.min))
        return FakeCursor(results)

    async def update_one(self, query, update):
        doc = await self.find_one(query)
        if doc and "$set" in update:
            doc.update(update["$set"])

    async def delete_one(self, query):
        doc = await self.find_one(query)
        if doc:
            del self.docs[doc["_id"]]

    async def delete_many(self, query):
        for d in list(self.docs.values()):
            if all(d.get(k) == v for k, v in query.items()):
                del self.docs[d["_id"]]


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.journals = FakeCollection()
        self.messages = FakeCollection()

    async def command(self, *a, **k):
        return {"ok": 1}


@pytest.fixture()
def client(monkeypatch, tmp_path):
    import app.db.mongodb as mongodb_module
    import app.services.journal_service as journal_service
    from app.main import app
    from app.services import media as media_module

    fake_db = FakeDB()
    monkeypatch.setattr(mongodb_module, "database", fake_db)

    async def fake_connect():
        # Startup event would otherwise open a real MongoDB connection and
        # overwrite `database` with it -- keep using the fake instead.
        mongodb_module.database = fake_db

    async def fake_close():
        pass

    monkeypatch.setattr(mongodb_module, "connect_to_mongo", fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", fake_close)
    monkeypatch.setattr("app.main.connect_to_mongo", fake_connect)
    monkeypatch.setattr("app.main.close_mongo_connection", fake_close)

    # Redirect media writes to a throwaway temp dir for the test run.
    monkeypatch.setattr(media_module, "MEDIA_ROOT", tmp_path)
    monkeypatch.setattr(media_module, "AUDIO_DIR", tmp_path / "audio")
    monkeypatch.setattr(media_module, "TTS_DIR", tmp_path / "tts")
    (tmp_path / "audio").mkdir()
    (tmp_path / "tts").mkdir()

    async def fake_reflection(transcript):
        return {"title": "Test Reflection", "body": ["Body A", "Body B"], "highlight_word": "testing"}

    async def fake_transcribe(audio_bytes, *args, **kwargs):
        return {"text": "This is a fake transcript of my day.", "language": "en"}

    async def fake_chat_reply(transcript, history):
        return "That sounds like a meaningful thing to reflect on."

    monkeypatch.setattr(journal_service, "generate_reflection", fake_reflection)
    monkeypatch.setattr(journal_service, "transcribe_audio", fake_transcribe)
    monkeypatch.setattr(journal_service, "generate_chat_reply", fake_chat_reply)

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers(client):
    client.post("/api/v1/auth/register", json={"email": "test@example.com", "password": "password1"})
    r = client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "password1"})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
