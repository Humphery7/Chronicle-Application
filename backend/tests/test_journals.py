def _create_journal(client, auth_headers, mood="Calm"):
    files = {"file": ("test.m4a", b"FAKEAUDIOBYTES", "audio/x-m4a")}
    data = {"mood": mood, "duration_seconds": "12.5"}
    return client.post("/api/v1/journals", files=files, data=data, headers=auth_headers)


def test_create_and_fetch_journal(client, auth_headers):
    r = _create_journal(client, auth_headers)
    assert r.status_code == 201
    journal = r.json()
    assert journal["status"] == "ready"
    assert journal["transcript"] == "This is a fake transcript of my day."
    assert journal["reflection"]["title"] == "Test Reflection"
    assert journal["audio_url"].startswith("/media/audio/")

    r = client.get(f"/api/v1/journals/{journal['_id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["_id"] == journal["_id"]


def test_list_journals_returns_summaries(client, auth_headers):
    _create_journal(client, auth_headers, mood="Happy")
    _create_journal(client, auth_headers, mood="Anxious")

    r = client.get("/api/v1/journals", headers=auth_headers)
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 2
    assert {"preview", "mood", "duration_seconds", "status"} <= entries[0].keys()


def test_conversation_seeded_with_reflection_and_grows_with_chat(client, auth_headers):
    journal = _create_journal(client, auth_headers).json()
    journal_id = journal["_id"]

    r = client.get(f"/api/v1/journals/{journal_id}/messages", headers=auth_headers)
    messages = r.json()
    assert len(messages) == 1
    assert messages[0]["role"] == "assistant"

    r = client.post(
        f"/api/v1/journals/{journal_id}/messages",
        json={"content": "I felt anxious today"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    turn = r.json()
    assert turn["user_message"]["content"] == "I felt anxious today"
    assert turn["assistant_message"]["role"] == "assistant"

    r = client.get(f"/api/v1/journals/{journal_id}/messages", headers=auth_headers)
    assert len(r.json()) == 3


def test_journal_isolated_per_user(client):
    client.post("/api/v1/auth/register", json={"email": "u1@x.com", "password": "password1"})
    t1 = client.post("/api/v1/auth/login", json={"email": "u1@x.com", "password": "password1"}).json()["access_token"]
    client.post("/api/v1/auth/register", json={"email": "u2@x.com", "password": "password1"})
    t2 = client.post("/api/v1/auth/login", json={"email": "u2@x.com", "password": "password1"}).json()["access_token"]

    h1 = {"Authorization": f"Bearer {t1}"}
    h2 = {"Authorization": f"Bearer {t2}"}

    journal = _create_journal(client, h1).json()

    r = client.get(f"/api/v1/journals/{journal['_id']}", headers=h2)
    assert r.status_code == 404

    r = client.get("/api/v1/journals", headers=h2)
    assert r.json() == []


def test_update_and_delete_journal(client, auth_headers):
    journal = _create_journal(client, auth_headers).json()

    r = client.patch(f"/api/v1/journals/{journal['_id']}", json={"mood": "Happy"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["mood"] == "Happy"

    r = client.delete(f"/api/v1/journals/{journal['_id']}", headers=auth_headers)
    assert r.status_code == 204

    r = client.get(f"/api/v1/journals/{journal['_id']}", headers=auth_headers)
    assert r.status_code == 404


def test_journals_require_auth(client):
    r = client.get("/api/v1/journals")
    assert r.status_code == 401
