import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.seed import seed_database
from app.models.supplier import Supplier
from app.models.dependency import Dependency

# Test in-memory database
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Seed the database
    seed_database(db)
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# 1. GET /suppliers returns seeded suppliers
def test_get_suppliers_returns_seeded_suppliers(client):
    response = client.get("/suppliers")
    assert response.status_code == 200
    suppliers = response.json()
    assert isinstance(suppliers, list)
    assert len(suppliers) == 24

    first = suppliers[0]
    assert "id" in first
    assert "name" in first
    assert "region" in first
    assert "country" in first
    assert "category" in first
    assert "annual_spend" in first
    assert "criticality_tier" in first
    assert first["current_risk_score"] is None  # Risk scores not populated yet in Phase 2
    assert first["dependency_count"] >= 1
    assert len(first["product_lines"]) >= 1


# 2. Pagination works
def test_suppliers_pagination(client):
    # Fetch first 5
    res1 = client.get("/suppliers?limit=5&offset=0")
    assert res1.status_code == 200
    page1 = res1.json()
    assert len(page1) == 5

    # Fetch next 5
    res2 = client.get("/suppliers?limit=5&offset=5")
    assert res2.status_code == 200
    page2 = res2.json()
    assert len(page2) == 5

    page1_ids = {s["id"] for s in page1}
    page2_ids = {s["id"] for s in page2}
    assert page1_ids.isdisjoint(page2_ids)


# 3. GET /suppliers/{id} returns a valid supplier
def test_get_supplier_detail_valid(client):
    res = client.get("/suppliers")
    suppliers = res.json()
    supplier_id = suppliers[0]["id"]

    detail_res = client.get(f"/suppliers/{supplier_id}")
    assert detail_res.status_code == 200
    data = detail_res.json()

    assert data["id"] == supplier_id
    assert "name" in data
    assert "dependencies" in data
    assert isinstance(data["dependencies"], list)
    assert len(data["dependencies"]) >= 1
    assert "product_lines_affected" in data
    assert len(data["product_lines_affected"]) >= 1
    assert data["risk_history"] == []  # Expected empty in Phase 2
    assert data["related_risk_events"] == []  # Expected empty in Phase 2


# 4. GET /suppliers/{invalid_id} returns 404
def test_get_supplier_detail_invalid_404(client):
    fake_id = str(uuid.uuid4())
    res = client.get(f"/suppliers/{fake_id}")
    assert res.status_code == 404
    error_data = res.json()
    assert "detail" in error_data


# 5. GET /network returns nodes and edges
def test_get_network_returns_nodes_and_edges(client):
    res = client.get("/network")
    assert res.status_code == 200
    data = res.json()

    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 24
    assert len(data["edges"]) >= 40

    # Verify node structure
    sample_node = data["nodes"][0]
    assert "id" in sample_node
    assert "name" in sample_node
    assert "type" in sample_node
    assert "region" in sample_node
    assert "country" in sample_node
    assert "category" in sample_node
    assert "criticality_tier" in sample_node

    # Verify edge structure
    sample_edge = data["edges"][0]
    assert "id" in sample_edge
    assert "source" in sample_edge
    assert "target" in sample_edge
    assert "dependency_weight" in sample_edge
    assert "company_product" in sample_edge


# 6. Network edges reference valid supplier nodes
def test_network_edges_reference_valid_supplier_nodes(client):
    res = client.get("/network")
    assert res.status_code == 200
    data = res.json()

    nodes = data["nodes"]
    edges = data["edges"]

    supplier_node_ids = {n["id"] for n in nodes if n["type"] == "supplier"}
    all_node_ids = {n["id"] for n in nodes}

    assert len(supplier_node_ids) == 24

    for edge in edges:
        # Source must be a valid supplier node
        assert edge["source"] in supplier_node_ids
        # Target must exist in graph nodes
        assert edge["target"] in all_node_ids
        assert 0.0 <= edge["dependency_weight"] <= 1.0
        assert len(edge["company_product"]) > 0


# 7. Seed execution is idempotent
def test_seed_execution_is_idempotent(test_db):
    count_suppliers_initial = test_db.query(Supplier).count()
    count_deps_initial = test_db.query(Dependency).count()

    # Re-run seed on already populated database
    results_second = seed_database(test_db)
    assert results_second["suppliers"] == count_suppliers_initial
    assert results_second["dependencies"] == count_deps_initial

    # Run third time
    results_third = seed_database(test_db)
    assert results_third["suppliers"] == count_suppliers_initial
    assert results_third["dependencies"] == count_deps_initial


# 8. Supplier relationships are correctly persisted
def test_supplier_relationships_persisted(test_db):
    supplier = (
        test_db.query(Supplier)
        .filter(Supplier.name == "Pacific Silicon Foundry")
        .first()
    )
    assert supplier is not None
    assert len(supplier.dependencies) >= 2

    # Check back-population relationship
    for dep in supplier.dependencies:
        assert dep.supplier.name == "Pacific Silicon Foundry"
        assert dep.supplier_id == supplier.id
        assert 0.0 <= dep.dependency_weight <= 1.0
        assert dep.company_product in ["Flagship Smartphone", "Smart Wearable"]
