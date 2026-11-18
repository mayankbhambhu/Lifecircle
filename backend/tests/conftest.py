import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["LIFECIRCLE_DB"] = f"sqlite:///{_tmp}/test.db"
os.environ["LIFECIRCLE_DEMO"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402


@pytest.fixture()
def client():
    reset_and_seed()
    with TestClient(app) as c:
        yield c


def login(client, role):
    r = client.post("/api/auth/demo-login", json={"role": role})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def as_role(client):
    return lambda role: login(client, role)
