import sys
from typing import Dict
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base
from app.models.supplier import Supplier
from app.models.dependency import Dependency
from app.data.seed_data import (
    get_deterministic_suppliers,
    get_deterministic_dependencies,
)


def seed_database(db: Session) -> Dict[str, int]:
    """
    Deterministically and idempotently seeds the SentinelX database
    with the hypothetical electronics manufacturer's supplier network
    and product line dependencies.

    Safe to execute repeatedly without creating duplicates.
    """
    suppliers_data = get_deterministic_suppliers()
    supplier_name_to_id = {}

    # 1. Upsert Suppliers
    for s_info in suppliers_data:
        supplier_id = s_info["id"]
        supplier_name_to_id[s_info["name"]] = supplier_id

        existing_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if existing_supplier:
            # Update attributes to ensure consistency
            existing_supplier.name = s_info["name"]
            existing_supplier.region = s_info["region"]
            existing_supplier.country = s_info["country"]
            existing_supplier.category = s_info["category"]
            existing_supplier.annual_spend = s_info["annual_spend"]
            existing_supplier.criticality_tier = s_info["criticality_tier"]
        else:
            new_supplier = Supplier(
                id=supplier_id,
                name=s_info["name"],
                region=s_info["region"],
                country=s_info["country"],
                category=s_info["category"],
                annual_spend=s_info["annual_spend"],
                criticality_tier=s_info["criticality_tier"],
            )
            db.add(new_supplier)

    db.flush()

    # 2. Upsert Dependencies
    deps_data = get_deterministic_dependencies(supplier_name_to_id)
    for d_info in deps_data:
        dep_id = d_info["id"]
        existing_dep = (
            db.query(Dependency)
            .filter(
                (Dependency.id == dep_id)
                | (
                    (Dependency.company_product == d_info["company_product"])
                    & (Dependency.supplier_id == d_info["supplier_id"])
                )
            )
            .first()
        )

        if existing_dep:
            existing_dep.dependency_weight = d_info["dependency_weight"]
            existing_dep.company_product = d_info["company_product"]
        else:
            new_dep = Dependency(
                id=dep_id,
                company_product=d_info["company_product"],
                supplier_id=d_info["supplier_id"],
                dependency_weight=d_info["dependency_weight"],
            )
            db.add(new_dep)

    db.commit()

    total_suppliers = db.query(Supplier).count()
    total_dependencies = db.query(Dependency).count()

    print(f"✓ Seeding complete: {total_suppliers} suppliers, {total_dependencies} dependencies.")
    return {
        "suppliers": total_suppliers,
        "dependencies": total_dependencies,
    }


def main():
    # Ensure tables exist (especially if seeding against fresh local database)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        results = seed_database(db)
        print(f"SentinelX seed successful: {results['suppliers']} suppliers, {results['dependencies']} dependencies.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    main()
