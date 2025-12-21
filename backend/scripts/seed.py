#!/usr/bin/env python3
"""Database seeder script for development."""

import asyncio
import random
from datetime import date, timedelta

from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Initialize faker and password context
fake = Faker()
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Database URL from environment or default
import os
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev"
)

# Admin credentials - these will be printed at the end
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
ADMIN_FULL_NAME = "Admin User"


async def clear_tables(session: AsyncSession):
    """Clear all tables in reverse dependency order."""
    print("Clearing existing data...")

    # Warehouse schema tables (in dependency order)
    await session.execute(text("DELETE FROM warehouse.loans"))
    await session.execute(text("DELETE FROM warehouse.borrowers"))
    await session.execute(text("DELETE FROM warehouse.inventory"))
    await session.execute(text("DELETE FROM warehouse.containers"))
    await session.execute(text("DELETE FROM warehouse.items"))
    await session.execute(text("DELETE FROM warehouse.categories"))
    await session.execute(text("DELETE FROM warehouse.locations"))

    # Auth schema tables
    await session.execute(text("DELETE FROM auth.notifications"))
    await session.execute(text("DELETE FROM auth.workspace_members"))
    await session.execute(text("DELETE FROM auth.workspaces"))
    await session.execute(text("DELETE FROM auth.users"))

    await session.commit()


async def create_admin_user(session: AsyncSession) -> tuple[str, str]:
    """Create admin user and workspace, return (user_id, workspace_id)."""
    print("Creating admin user...")

    password_hash = pwd_context.hash(ADMIN_PASSWORD)

    # Create user
    result = await session.execute(
        text("""
            INSERT INTO auth.users (email, full_name, password_hash, is_active)
            VALUES (:email, :full_name, :password_hash, true)
            RETURNING id
        """),
        {"email": ADMIN_EMAIL, "full_name": ADMIN_FULL_NAME, "password_hash": password_hash}
    )
    user_id = str(result.scalar_one())

    # Create workspace
    result = await session.execute(
        text("""
            INSERT INTO auth.workspaces (name, slug, description)
            VALUES (:name, :slug, :description)
            RETURNING id
        """),
        {"name": "Home Warehouse", "slug": "home-warehouse", "description": "Main home inventory workspace"}
    )
    workspace_id = str(result.scalar_one())

    # Create membership
    await session.execute(
        text("""
            INSERT INTO auth.workspace_members (workspace_id, user_id, role)
            VALUES (:workspace_id, :user_id, 'owner')
        """),
        {"workspace_id": workspace_id, "user_id": user_id}
    )

    await session.commit()
    return user_id, workspace_id


async def create_test_users(session: AsyncSession) -> list[str]:
    """Create additional test users for testing invites."""
    print("Creating test users...")

    test_users = [
        ("john.doe@example.com", "John Doe", "password123"),
        ("jane.smith@example.com", "Jane Smith", "password123"),
        ("mike.wilson@example.com", "Mike Wilson", "password123"),
        ("sarah.jones@example.com", "Sarah Jones", "password123"),
        ("bob.miller@example.com", "Bob Miller", "password123"),
    ]

    user_ids = []
    for email, full_name, password in test_users:
        password_hash = pwd_context.hash(password)
        result = await session.execute(
            text("""
                INSERT INTO auth.users (email, full_name, password_hash, is_active)
                VALUES (:email, :full_name, :password_hash, true)
                RETURNING id
            """),
            {"email": email, "full_name": full_name, "password_hash": password_hash}
        )
        user_ids.append(str(result.scalar_one()))

    await session.commit()
    return user_ids


async def create_categories(session: AsyncSession, workspace_id: str) -> list[str]:
    """Create categories with hierarchy."""
    print("Creating categories...")

    category_ids = []

    # Root categories
    root_categories = [
        ("Electronics", "Electronic devices and accessories"),
        ("Tools", "Hand tools, power tools, and equipment"),
        ("Kitchen", "Kitchen appliances and utensils"),
        ("Outdoor", "Garden and outdoor equipment"),
        ("Storage", "Boxes, containers, and organizers"),
        ("Sports", "Sports equipment and gear"),
        ("Office", "Office supplies and equipment"),
    ]

    root_ids = {}
    for name, desc in root_categories:
        result = await session.execute(
            text("""
                INSERT INTO warehouse.categories (workspace_id, name, description)
                VALUES (:workspace_id, :name, :description)
                RETURNING id
            """),
            {"workspace_id": workspace_id, "name": name, "description": desc}
        )
        cat_id = str(result.scalar_one())
        root_ids[name] = cat_id
        category_ids.append(cat_id)

    # Subcategories
    subcategories = [
        ("Cables", "Power cords, USB cables, adapters", "Electronics"),
        ("Audio", "Speakers, headphones, microphones", "Electronics"),
        ("Computers", "Laptops, desktops, peripherals", "Electronics"),
        ("Power Tools", "Drills, saws, sanders", "Tools"),
        ("Hand Tools", "Screwdrivers, wrenches, pliers", "Tools"),
        ("Measuring", "Tape measures, levels, rulers", "Tools"),
        ("Appliances", "Small kitchen appliances", "Kitchen"),
        ("Cookware", "Pots, pans, baking dishes", "Kitchen"),
        ("Utensils", "Spatulas, spoons, knives", "Kitchen"),
        ("Garden Tools", "Shovels, rakes, pruners", "Outdoor"),
        ("Lawn Care", "Mowers, trimmers, sprinklers", "Outdoor"),
        ("Boxes", "Cardboard and plastic boxes", "Storage"),
        ("Bins", "Storage bins and totes", "Storage"),
        ("Fitness", "Weights, mats, bands", "Sports"),
        ("Camping", "Tents, sleeping bags, coolers", "Sports"),
    ]

    for name, desc, parent in subcategories:
        result = await session.execute(
            text("""
                INSERT INTO warehouse.categories (workspace_id, name, description, parent_category_id)
                VALUES (:workspace_id, :name, :description, :parent_id)
                RETURNING id
            """),
            {"workspace_id": workspace_id, "name": name, "description": desc, "parent_id": root_ids[parent]}
        )
        category_ids.append(str(result.scalar_one()))

    await session.commit()
    return category_ids


async def create_locations(session: AsyncSession, workspace_id: str) -> list[str]:
    """Create locations."""
    print("Creating locations...")

    location_ids = []

    locations = [
        ("Garage", "North Wall", "Top Shelf", None, "Main garage storage area"),
        ("Garage", "North Wall", "Middle Shelf", None, "Power tools and equipment"),
        ("Garage", "South Wall", "Workbench", None, "Workbench and small tools"),
        ("Kitchen", "Pantry", "Top Shelf", None, "Rarely used items"),
        ("Kitchen", "Pantry", "Middle Shelf", None, "Frequently used items"),
        ("Kitchen", "Under Sink", None, None, "Cleaning supplies"),
        ("Bedroom", "Closet", "Top Shelf", None, "Seasonal storage"),
        ("Bedroom", "Closet", "Dresser", None, "Daily items"),
        ("Office", "Desk", "Drawer 1", None, "Office supplies"),
        ("Office", "Bookshelf", "Shelf 1", None, "Books and documents"),
        ("Basement", "Storage Room", "Rack A", "Bin 1", "Long-term storage"),
        ("Basement", "Storage Room", "Rack A", "Bin 2", "Holiday decorations"),
        ("Basement", "Storage Room", "Rack B", "Bin 1", "Sports equipment"),
        ("Attic", None, None, None, "Attic storage space"),
        ("Shed", "Tool Wall", None, None, "Garden tools"),
    ]

    for name, zone, shelf, bin_, desc in locations:
        result = await session.execute(
            text("""
                INSERT INTO warehouse.locations (workspace_id, name, zone, shelf, bin, description)
                VALUES (:workspace_id, :name, :zone, :shelf, :bin, :description)
                RETURNING id
            """),
            {"workspace_id": workspace_id, "name": name, "zone": zone, "shelf": shelf, "bin": bin_, "description": desc}
        )
        location_ids.append(str(result.scalar_one()))

    await session.commit()
    return location_ids


async def create_containers(session: AsyncSession, workspace_id: str, location_ids: list[str]) -> list[str]:
    """Create containers."""
    print("Creating containers...")

    container_ids = []

    container_types = [
        "Plastic Bin", "Cardboard Box", "Tool Box", "Storage Tote",
        "Wire Basket", "Drawer Organizer", "Shelf Box", "Clear Container"
    ]

    for i in range(20):
        location_id = random.choice(location_ids)
        container_type = random.choice(container_types)
        short_code = f"{chr(65 + i // 10)}{i % 10:02d}"

        result = await session.execute(
            text("""
                INSERT INTO warehouse.containers (workspace_id, name, location_id, description, capacity, short_code)
                VALUES (:workspace_id, :name, :location_id, :description, :capacity, :short_code)
                RETURNING id
            """),
            {
                "workspace_id": workspace_id,
                "name": f"{container_type} #{i + 1}",
                "location_id": location_id,
                "description": fake.sentence(),
                "capacity": random.choice(["Small", "Medium", "Large", "XL"]),
                "short_code": short_code,
            }
        )
        container_ids.append(str(result.scalar_one()))

    await session.commit()
    return container_ids


async def create_items(session: AsyncSession, workspace_id: str, category_ids: list[str]) -> list[str]:
    """Create items."""
    print("Creating items...")

    item_ids = []

    items = [
        ("Cordless Drill", "DeWalt 20V MAX cordless drill"),
        ("Hammer", "16oz claw hammer"),
        ("Screwdriver Set", "32-piece precision screwdriver set"),
        ("USB-C Cable", "6ft USB-C to USB-A cable"),
        ("HDMI Cable", "10ft high-speed HDMI cable"),
        ("Power Strip", "6-outlet surge protector"),
        ("LED Flashlight", "Rechargeable tactical flashlight"),
        ("Tape Measure", "25ft retractable tape measure"),
        ("Level", "24-inch spirit level"),
        ("Wrench Set", "SAE/Metric combination wrench set"),
        ("Blender", "High-speed countertop blender"),
        ("Toaster", "4-slice stainless steel toaster"),
        ("Coffee Maker", "12-cup programmable coffee maker"),
        ("Cast Iron Pan", "12-inch pre-seasoned cast iron skillet"),
        ("Knife Set", "8-piece kitchen knife block set"),
        ("Extension Cord", "50ft outdoor extension cord"),
        ("Garden Hose", "100ft expandable garden hose"),
        ("Pruning Shears", "Bypass pruning shears"),
        ("Shovel", "Round point digging shovel"),
        ("Rake", "24-inch leaf rake"),
        ("Tent", "4-person camping tent"),
        ("Sleeping Bag", "0-degree mummy sleeping bag"),
        ("Camping Stove", "Portable propane camping stove"),
        ("Yoga Mat", "Extra thick exercise mat"),
        ("Dumbbells", "Adjustable dumbbell set"),
        ("Resistance Bands", "5-piece resistance band set"),
        ("Bluetooth Speaker", "Portable waterproof speaker"),
        ("Webcam", "1080p HD webcam"),
        ("Mouse", "Wireless ergonomic mouse"),
        ("Keyboard", "Mechanical gaming keyboard"),
        ("Monitor Stand", "Adjustable monitor riser"),
        ("Desk Lamp", "LED desk lamp with USB charging"),
        ("Storage Bins", "Set of 6 clear storage bins"),
        ("Label Maker", "Handheld label printer"),
        ("Moving Boxes", "Pack of 10 moving boxes"),
    ]

    for i, (name, description) in enumerate(items):
        sku = f"SKU-{i + 1:04d}"
        category_id = random.choice(category_ids) if random.random() > 0.1 else None

        result = await session.execute(
            text("""
                INSERT INTO warehouse.items (workspace_id, sku, name, description, category_id)
                VALUES (:workspace_id, :sku, :name, :description, :category_id)
                RETURNING id
            """),
            {
                "workspace_id": workspace_id,
                "sku": sku,
                "name": name,
                "description": description,
                "category_id": category_id,
            }
        )
        item_ids.append(str(result.scalar_one()))

    await session.commit()
    return item_ids


async def create_inventory(session: AsyncSession, workspace_id: str, item_ids: list[str], location_ids: list[str]) -> list[str]:
    """Create inventory records."""
    print("Creating inventory...")

    inventory_ids = []
    used_combos = set()

    for item_id in item_ids:
        # Each item can be in 1-3 locations
        num_locations = random.randint(1, 3)
        locs = random.sample(location_ids, min(num_locations, len(location_ids)))

        for location_id in locs:
            combo = (item_id, location_id)
            if combo in used_combos:
                continue
            used_combos.add(combo)

            result = await session.execute(
                text("""
                    INSERT INTO warehouse.inventory (workspace_id, item_id, location_id, quantity)
                    VALUES (:workspace_id, :item_id, :location_id, :quantity)
                    RETURNING id
                """),
                {
                    "workspace_id": workspace_id,
                    "item_id": item_id,
                    "location_id": location_id,
                    "quantity": random.randint(1, 10),
                }
            )
            inventory_ids.append(str(result.scalar_one()))

    await session.commit()
    return inventory_ids


async def create_borrowers(session: AsyncSession, workspace_id: str) -> list[str]:
    """Create borrowers."""
    print("Creating borrowers...")

    borrower_ids = []

    for _ in range(10):
        result = await session.execute(
            text("""
                INSERT INTO warehouse.borrowers (workspace_id, name, email, phone, notes)
                VALUES (:workspace_id, :name, :email, :phone, :notes)
                RETURNING id
            """),
            {
                "workspace_id": workspace_id,
                "name": fake.name(),
                "email": fake.email() if random.random() > 0.3 else None,
                "phone": fake.phone_number() if random.random() > 0.3 else None,
                "notes": fake.sentence() if random.random() > 0.5 else None,
            }
        )
        borrower_ids.append(str(result.scalar_one()))

    await session.commit()
    return borrower_ids


async def create_loans(session: AsyncSession, workspace_id: str, inventory_ids: list[str], borrower_ids: list[str]):
    """Create loans."""
    print("Creating loans...")

    # Use unique inventory IDs for active loans to avoid constraint violation
    active_loan_inventory = random.sample(inventory_ids, min(5, len(inventory_ids)))

    # Create some active loans
    for inventory_id in active_loan_inventory:
        borrower_id = random.choice(borrower_ids)
        loaned_days_ago = random.randint(1, 30)
        due_in_days = random.randint(-5, 14)  # Some overdue

        await session.execute(
            text("""
                INSERT INTO warehouse.loans (workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, notes)
                VALUES (:workspace_id, :inventory_id, :borrower_id, :quantity,
                        NOW() - INTERVAL ':days days', :due_date, :notes)
            """.replace(":days", str(loaned_days_ago))),
            {
                "workspace_id": workspace_id,
                "inventory_id": inventory_id,
                "borrower_id": borrower_id,
                "quantity": random.randint(1, 2),
                "due_date": date.today() + timedelta(days=due_in_days),
                "notes": fake.sentence() if random.random() > 0.5 else None,
            }
        )

    # Create some returned loans (these can use any inventory since they're not active)
    for _ in range(8):
        inventory_id = random.choice(inventory_ids)
        borrower_id = random.choice(borrower_ids)
        loaned_days_ago = random.randint(30, 90)
        returned_days_ago = random.randint(1, loaned_days_ago - 1)

        await session.execute(
            text("""
                INSERT INTO warehouse.loans (workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, returned_at, notes)
                VALUES (:workspace_id, :inventory_id, :borrower_id, :quantity,
                        NOW() - INTERVAL ':loaned days', :due_date, NOW() - INTERVAL ':returned days', :notes)
            """.replace(":loaned", str(loaned_days_ago)).replace(":returned", str(returned_days_ago))),
            {
                "workspace_id": workspace_id,
                "inventory_id": inventory_id,
                "borrower_id": borrower_id,
                "quantity": random.randint(1, 2),
                "due_date": date.today() - timedelta(days=returned_days_ago + 7),
                "notes": fake.sentence() if random.random() > 0.5 else None,
            }
        )

    await session.commit()


async def create_notifications(session: AsyncSession, user_id: str, workspace_id: str) -> int:
    """Create sample notifications."""
    print("Creating notifications...")

    notifications = [
        # Workspace invite notification (unread)
        {
            "notification_type": "WORKSPACE_INVITE",
            "title": "Invited to Family Storage",
            "message": "John Doe invited you to join 'Family Storage' as admin.",
            "is_read": False,
            "metadata": '{"workspace_name": "Family Storage", "role": "admin", "invited_by": "John Doe"}',
        },
        # Member joined notification (unread)
        {
            "notification_type": "MEMBER_JOINED",
            "title": "New member in Home Warehouse",
            "message": "Jane Smith joined 'Home Warehouse' as member.",
            "is_read": False,
            "metadata": '{"workspace_name": "Home Warehouse", "new_member": "Jane Smith", "role": "member"}',
        },
        # Loan due soon notification (unread)
        {
            "notification_type": "LOAN_DUE_SOON",
            "title": "Loan Due Soon",
            "message": "'Cordless Drill' loaned to Mike Johnson is due tomorrow.",
            "is_read": False,
            "metadata": '{"item_name": "Cordless Drill", "borrower_name": "Mike Johnson", "due_date": "2024-12-22"}',
        },
        # Loan overdue notification (read)
        {
            "notification_type": "LOAN_OVERDUE",
            "title": "Loan Overdue",
            "message": "'Extension Cord' loaned to Sarah Williams was due 3 days ago.",
            "is_read": True,
            "metadata": '{"item_name": "Extension Cord", "borrower_name": "Sarah Williams", "due_date": "2024-12-18"}',
        },
        # System notification (read)
        {
            "notification_type": "SYSTEM",
            "title": "Welcome to Home Warehouse System",
            "message": "Thank you for joining! Start by adding items and locations to your inventory.",
            "is_read": True,
            "metadata": None,
        },
    ]

    count = 0
    for notif in notifications:
        await session.execute(
            text("""
                INSERT INTO auth.notifications (user_id, workspace_id, notification_type, title, message, is_read, metadata, created_at)
                VALUES (:user_id, :workspace_id, :notification_type, :title, :message, :is_read, :metadata, NOW() - INTERVAL ':hours hours')
            """.replace(":hours", str(count * 2 + 1))),
            {
                "user_id": user_id,
                "workspace_id": workspace_id,
                "notification_type": notif["notification_type"],
                "title": notif["title"],
                "message": notif["message"],
                "is_read": notif["is_read"],
                "metadata": notif["metadata"],
            }
        )
        count += 1

    await session.commit()
    return count


async def main():
    """Main seeder function."""
    print("=" * 60)
    print("Database Seeder")
    print("=" * 60)
    print(f"Database: {DATABASE_URL}")
    print()

    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Clear existing data
        await clear_tables(session)

        # Create admin user and workspace
        user_id, workspace_id = await create_admin_user(session)

        # Create test users for invite testing
        test_user_ids = await create_test_users(session)

        # Create categories
        category_ids = await create_categories(session, workspace_id)

        # Create locations
        location_ids = await create_locations(session, workspace_id)

        # Create containers
        container_ids = await create_containers(session, workspace_id, location_ids)

        # Create items
        item_ids = await create_items(session, workspace_id, category_ids)

        # Create inventory
        inventory_ids = await create_inventory(session, workspace_id, item_ids, location_ids)

        # Create borrowers
        borrower_ids = await create_borrowers(session, workspace_id)

        # Create loans
        await create_loans(session, workspace_id, inventory_ids, borrower_ids)

        # Create notifications
        notification_count = await create_notifications(session, user_id, workspace_id)

    await engine.dispose()

    print()
    print("=" * 60)
    print("Seeding complete!")
    print("=" * 60)
    print()
    print("Summary:")
    print(f"  - Test users: {len(test_user_ids)}")
    print(f"  - Categories: {len(category_ids)}")
    print(f"  - Locations: {len(location_ids)}")
    print(f"  - Containers: {len(container_ids)}")
    print(f"  - Items: {len(item_ids)}")
    print(f"  - Inventory records: {len(inventory_ids)}")
    print(f"  - Borrowers: {len(borrower_ids)}")
    print(f"  - Loans: 13 (5 active, 8 returned)")
    print(f"  - Notifications: {notification_count} (3 unread, 2 read)")
    print()
    print("=" * 60)
    print("Admin Login Credentials:")
    print("=" * 60)
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print("=" * 60)
    print()
    print("Test Users (for invite testing):")
    print("  - john.doe@example.com (password123)")
    print("  - jane.smith@example.com (password123)")
    print("  - mike.wilson@example.com (password123)")
    print("  - sarah.jones@example.com (password123)")
    print("  - bob.miller@example.com (password123)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
