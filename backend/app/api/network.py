from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload, joinedload

from app.core.database import get_db
from app.models.supplier import Supplier
from app.models.dependency import Dependency
from app.schemas.network import NetworkNode, NetworkEdge, NetworkGraphResponse
from app.data.seed_data import PRODUCT_LINES

router = APIRouter(prefix="/network", tags=["Network"])


@router.get("", response_model=NetworkGraphResponse)
def get_network_graph(
    db: Session = Depends(get_db),
) -> NetworkGraphResponse:
    """
    Returns graph-ready supply chain network topology for force-directed visualization.
    Nodes represent suppliers and company product lines.
    Edges represent weighted dependency links between suppliers and products.
    """
    # 1. Fetch all suppliers with risk scores in a single query
    suppliers = (
        db.query(Supplier)
        .options(selectinload(Supplier.risk_scores))
        .all()
    )

    # 2. Fetch all dependencies with joined supplier in a single query
    dependencies = (
        db.query(Dependency)
        .options(joinedload(Dependency.supplier))
        .all()
    )

    nodes = []
    # Add Supplier Nodes
    for s in suppliers:
        latest_score = None
        if s.risk_scores:
            latest = max(s.risk_scores, key=lambda rs: rs.timestamp)
            latest_score = latest.risk_score

        nodes.append(
            NetworkNode(
                id=str(s.id),
                name=s.name,
                type="supplier",
                region=s.region,
                country=s.country,
                category=s.category,
                criticality_tier=s.criticality_tier,
                annual_spend=s.annual_spend,
                current_risk_score=latest_score,
            )
        )

    # Add Product Line Hub Nodes
    # Use distinct product lines from dependencies or fallback to default PRODUCT_LINES
    discovered_products = set(d.company_product for d in dependencies)
    all_products = sorted(list(discovered_products.union(set(PRODUCT_LINES))))

    for prod in all_products:
        nodes.append(
            NetworkNode(
                id=f"product:{prod}",
                name=prod,
                type="product",
                region="Global",
                country="Internal",
                category="Product Line",
                criticality_tier=1,
                annual_spend=None,
                current_risk_score=None,
            )
        )

    # Build Edges linking Supplier -> Product
    edges = []
    for dep in dependencies:
        edges.append(
            NetworkEdge(
                id=str(dep.id),
                source=str(dep.supplier_id),
                target=f"product:{dep.company_product}",
                dependency_weight=dep.dependency_weight,
                company_product=dep.company_product,
            )
        )

    return NetworkGraphResponse(nodes=nodes, edges=edges)
