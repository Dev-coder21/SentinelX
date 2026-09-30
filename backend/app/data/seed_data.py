import uuid
from typing import List, Dict, Any

# Deterministic namespace for SentinelX seed entities
NAMESPACE_SENTINELX = uuid.UUID("7b3f94c0-5c21-4f76-8092-1c2d3e4f5060")


def generate_supplier_id(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE_SENTINELX, f"supplier:{name}")


def generate_dependency_id(product: str, supplier_id: uuid.UUID) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE_SENTINELX, f"dependency:{product}:{supplier_id}")


PRODUCT_LINES = [
    "Flagship Smartphone",
    "Smart Wearable",
    "Consumer Tablet",
    "IoT Smart Hub",
]

RAW_SUPPLIERS: List[Dict[str, Any]] = [
    # --- East Asia (Taiwan, South Korea, Japan, China) ---
    {
        "name": "Pacific Silicon Foundry",
        "region": "East Asia",
        "country": "Taiwan",
        "category": "Semiconductors",
        "annual_spend": 6500000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Hanwa Microelectronics",
        "region": "East Asia",
        "country": "South Korea",
        "category": "Memory / storage",
        "annual_spend": 4800000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Kyoto Opto-Display Corp",
        "region": "East Asia",
        "country": "Japan",
        "category": "Displays",
        "annual_spend": 5200000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Formosa Advanced Substrates",
        "region": "East Asia",
        "country": "Taiwan",
        "category": "PCB / electronic components",
        "annual_spend": 2600000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Seoul Storage Solutions",
        "region": "East Asia",
        "country": "South Korea",
        "category": "Memory / storage",
        "annual_spend": 3500000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Tokyo Nano-Capacitors",
        "region": "East Asia",
        "country": "Japan",
        "category": "PCB / electronic components",
        "annual_spend": 920000.0,
        "criticality_tier": 3,
    },
    {
        "name": "Shenzhen Precision Interconnect",
        "region": "East Asia",
        "country": "China",
        "category": "Connectors",
        "annual_spend": 780000.0,
        "criticality_tier": 3,
    },
    {
        "name": "Osaka Thermal Technologies",
        "region": "East Asia",
        "country": "Japan",
        "category": "Mechanical components",
        "annual_spend": 850000.0,
        "criticality_tier": 3,
    },
    {
        "name": "Taipei Quartz Crystals",
        "region": "East Asia",
        "country": "Taiwan",
        "category": "PCB / electronic components",
        "annual_spend": 480000.0,
        "criticality_tier": 3,
    },

    # --- Southeast Asia (Vietnam, Malaysia, Singapore, Thailand, Philippines) ---
    {
        "name": "Zenith Power Dynamics",
        "region": "Southeast Asia",
        "country": "Vietnam",
        "category": "Batteries",
        "annual_spend": 3400000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Bangkok Precision Optics",
        "region": "Southeast Asia",
        "country": "Thailand",
        "category": "Sensors",
        "annual_spend": 1650000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Penang Micro Assembly",
        "region": "Southeast Asia",
        "country": "Malaysia",
        "category": "PCB / electronic components",
        "annual_spend": 1550000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Singapore Global Logistics Hub",
        "region": "Southeast Asia",
        "country": "Singapore",
        "category": "Logistics",
        "annual_spend": 2250000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Manila Flex Circuits",
        "region": "Southeast Asia",
        "country": "Philippines",
        "category": "Connectors",
        "annual_spend": 650000.0,
        "criticality_tier": 3,
    },

    # --- North America (United States, Mexico) ---
    {
        "name": "Silicon Valley RF Labs",
        "region": "North America",
        "country": "United States",
        "category": "Semiconductors",
        "annual_spend": 3800000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Austin Power Systems",
        "region": "North America",
        "country": "United States",
        "category": "Batteries",
        "annual_spend": 2400000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Guadalajara Mechatronics",
        "region": "North America",
        "country": "Mexico",
        "category": "Mechanical components",
        "annual_spend": 1350000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Delta Maritime Express",
        "region": "North America",
        "country": "United States",
        "category": "Logistics",
        "annual_spend": 1800000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Monterrey Polymer Enclosures",
        "region": "North America",
        "country": "Mexico",
        "category": "Mechanical components",
        "annual_spend": 560000.0,
        "criticality_tier": 3,
    },

    # --- Europe (Germany, Netherlands) ---
    {
        "name": "Eindhoven Litho Circuits",
        "region": "Europe",
        "country": "Netherlands",
        "category": "Semiconductors",
        "annual_spend": 4100000.0,
        "criticality_tier": 1,
    },
    {
        "name": "Bavaria Sensor Dynamics",
        "region": "Europe",
        "country": "Germany",
        "category": "Sensors",
        "annual_spend": 2100000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Zurich Micro-Acoustics",
        "region": "Europe",
        "country": "Germany",
        "category": "Sensors",
        "annual_spend": 1150000.0,
        "criticality_tier": 2,
    },
    {
        "name": "Nordic Green Packaging",
        "region": "Europe",
        "country": "Germany",
        "category": "Packaging",
        "annual_spend": 390000.0,
        "criticality_tier": 3,
    },
    {
        "name": "EuroPac Sustainable Cartons",
        "region": "Europe",
        "country": "Netherlands",
        "category": "Packaging",
        "annual_spend": 280000.0,
        "criticality_tier": 3,
    },
]

# (company_product, supplier_name, dependency_weight)
RAW_DEPENDENCY_MAPPINGS = [
    # --- Flagship Smartphone (13 dependencies) ---
    ("Flagship Smartphone", "Pacific Silicon Foundry", 0.95),
    ("Flagship Smartphone", "Kyoto Opto-Display Corp", 0.90),
    ("Flagship Smartphone", "Hanwa Microelectronics", 0.85),
    ("Flagship Smartphone", "Zenith Power Dynamics", 0.80),
    ("Flagship Smartphone", "Formosa Advanced Substrates", 0.75),
    ("Flagship Smartphone", "Silicon Valley RF Labs", 0.85),
    ("Flagship Smartphone", "Bangkok Precision Optics", 0.85),
    ("Flagship Smartphone", "Shenzhen Precision Interconnect", 0.45),
    ("Flagship Smartphone", "Osaka Thermal Technologies", 0.55),
    ("Flagship Smartphone", "Guadalajara Mechatronics", 0.70),
    ("Flagship Smartphone", "Tokyo Nano-Capacitors", 0.40),
    ("Flagship Smartphone", "Delta Maritime Express", 0.65),
    ("Flagship Smartphone", "Nordic Green Packaging", 0.25),

    # --- Smart Wearable (10 dependencies) ---
    ("Smart Wearable", "Pacific Silicon Foundry", 0.85),
    ("Smart Wearable", "Kyoto Opto-Display Corp", 0.80),
    ("Smart Wearable", "Bavaria Sensor Dynamics", 0.90),
    ("Smart Wearable", "Zenith Power Dynamics", 0.75),
    ("Smart Wearable", "Manila Flex Circuits", 0.50),
    ("Smart Wearable", "Zurich Micro-Acoustics", 0.70),
    ("Smart Wearable", "Monterrey Polymer Enclosures", 0.55),
    ("Smart Wearable", "Penang Micro Assembly", 0.60),
    ("Smart Wearable", "Singapore Global Logistics Hub", 0.70),
    ("Smart Wearable", "Nordic Green Packaging", 0.20),

    # --- Consumer Tablet (11 dependencies) ---
    ("Consumer Tablet", "Eindhoven Litho Circuits", 0.85),
    ("Consumer Tablet", "Kyoto Opto-Display Corp", 0.90),
    ("Consumer Tablet", "Seoul Storage Solutions", 0.85),
    ("Consumer Tablet", "Austin Power Systems", 0.75),
    ("Consumer Tablet", "Guadalajara Mechatronics", 0.75),
    ("Consumer Tablet", "Shenzhen Precision Interconnect", 0.40),
    ("Consumer Tablet", "Bangkok Precision Optics", 0.60),
    ("Consumer Tablet", "Tokyo Nano-Capacitors", 0.45),
    ("Consumer Tablet", "Formosa Advanced Substrates", 0.70),
    ("Consumer Tablet", "Delta Maritime Express", 0.70),
    ("Consumer Tablet", "EuroPac Sustainable Cartons", 0.25),

    # --- IoT Smart Hub (10 dependencies) ---
    ("IoT Smart Hub", "Silicon Valley RF Labs", 0.90),
    ("IoT Smart Hub", "Eindhoven Litho Circuits", 0.80),
    ("IoT Smart Hub", "Austin Power Systems", 0.60),
    ("IoT Smart Hub", "Bavaria Sensor Dynamics", 0.75),
    ("IoT Smart Hub", "Zurich Micro-Acoustics", 0.80),
    ("IoT Smart Hub", "Taipei Quartz Crystals", 0.50),
    ("IoT Smart Hub", "Monterrey Polymer Enclosures", 0.50),
    ("IoT Smart Hub", "Penang Micro Assembly", 0.65),
    ("IoT Smart Hub", "Singapore Global Logistics Hub", 0.60),
    ("IoT Smart Hub", "EuroPac Sustainable Cartons", 0.30),
]


def get_deterministic_suppliers() -> List[Dict[str, Any]]:
    """Returns suppliers with deterministic UUIDs."""
    suppliers = []
    for item in RAW_SUPPLIERS:
        supplier_id = generate_supplier_id(item["name"])
        suppliers.append({
            "id": supplier_id,
            "name": item["name"],
            "region": item["region"],
            "country": item["country"],
            "category": item["category"],
            "annual_spend": item["annual_spend"],
            "criticality_tier": item["criticality_tier"],
        })
    return suppliers


def get_deterministic_dependencies(supplier_name_to_id: Dict[str, uuid.UUID]) -> List[Dict[str, Any]]:
    """Returns dependencies with deterministic UUIDs linked to supplier UUIDs."""
    dependencies = []
    for product, supplier_name, weight in RAW_DEPENDENCY_MAPPINGS:
        if supplier_name not in supplier_name_to_id:
            raise KeyError(f"Supplier '{supplier_name}' not found in supplier map")
        s_id = supplier_name_to_id[supplier_name]
        dep_id = generate_dependency_id(product, s_id)
        dependencies.append({
            "id": dep_id,
            "company_product": product,
            "supplier_id": s_id,
            "dependency_weight": weight,
        })
    return dependencies
