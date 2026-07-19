def test_register_login_me(client):
    r = client.post("/api/v1/auth/register", json={"email": "a@b.com", "password": "password1"})
    assert r.status_code == 201
    assert r.json()["email"] == "a@b.com"

    r = client.post("/api/v1/auth/register", json={"email": "a@b.com", "password": "password1"})
    assert r.status_code == 400  # duplicate email

    r = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "wrong"})
    assert r.status_code == 401

    r = client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "password1"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "a@b.com"


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_weak_password_rejected(client):
    r = client.post("/api/v1/auth/register", json={"email": "a@b.com", "password": "nonumber"})
    assert r.status_code == 422
