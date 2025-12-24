import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from app.backend_app import app
from app import schemas

client = TestClient(app)

# Mock DB Session
@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def override_get_db(mock_db):
    from app.db.session import get_db
    app.dependency_overrides[get_db] = lambda: mock_db
    yield
    app.dependency_overrides = {}

def test_request_location_preferred(override_get_db, mock_db):
    """
    Test that locations in the request body take precedence.
    """
    # Mock DB add/commit/refresh
    mock_db.add = MagicMock()
    mock_db.commit = MagicMock()
    
    def side_effect_refresh(item):
        import uuid
        from datetime import datetime
        item.id = uuid.uuid4()
        item.created_at = datetime.now()
        item.updated_at = datetime.now()
        item.status = "pending" # Ensure status is set if default didn't trigger
    
    mock_db.refresh = MagicMock(side_effect=side_effect_refresh)

    payload = {
        "skills": ["Python", "FastAPI"],
        "preferred_locations": ["Kolkata"],
        "location": "Mumbai", # Should be included too
        "limit": 5
    }

    response = client.post("/opportunities/discover", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify DB insertion
    # We can inspect the call args to SearchQueue constructor if we mocked the class, 
    # but since we are testing the endpoint, we can check the returned object if it reflects the DB object.
    # However, the endpoint returns the queue_item.
    
    # In a real integration test we'd check the DB. 
    # Here we rely on the logic that the endpoint returns what it created.
    # But wait, the response model doesn't include resolved_locations_source unless we added it to the schema.
    # We didn't add it to SearchQueueResponse schema.
    # So we can't verify it in the response body directly unless we update the schema.
    # The user didn't ask to update the response schema, only the DB.
    # So we should verify via the mock_db.add call.
    
    args, _ = mock_db.add.call_args
    queue_item = args[0]
    
    assert queue_item.resolved_locations_source == "request"
    # "Kolkata" and "Mumbai" should be in filters["resolved_locations"]
    assert "Kolkata" in queue_item.filters["resolved_locations"]
    assert "Mumbai" in queue_item.filters["resolved_locations"]
    assert "Kolkata" in queue_item.query or "Mumbai" in queue_item.query

def test_default_location_fallback(override_get_db, mock_db):
    """
    Test fallback to default when no location provided.
    """
    mock_db.add = MagicMock()
    mock_db.commit = MagicMock()
    
    def side_effect_refresh(item):
        import uuid
        from datetime import datetime
        item.id = uuid.uuid4()
        item.created_at = datetime.now()
        item.updated_at = datetime.now()
        item.status = "pending"
        
    mock_db.refresh = MagicMock(side_effect=side_effect_refresh)

    payload = {
        "skills": ["Java"],
        # No location
    }

    response = client.post("/opportunities/discover", json=payload)
    
    assert response.status_code == 200
    
    args, _ = mock_db.add.call_args
    queue_item = args[0]
    
    assert queue_item.resolved_locations_source == "default"
    assert queue_item.filters["resolved_locations"] == ["Unknown"]

