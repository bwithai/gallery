#!/usr/bin/env python3
"""
Script to seed the database with predefined collections.
"""

import logging
from sqlmodel import Session, select

from app.core.db import engine
from app.models import Collection, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Predefined collections to insert
COLLECTIONS = [
    {
        "name": "Models & Statues",
        "description": "Collectible models, figurines, and statues from various genres and periods",
        "is_public": True
    },
    {
        "name": "Coins & Currency",
        "description": "Rare coins, paper money, and currency from around the world",
        "is_public": True
    },
    {
        "name": "Stamps",
        "description": "Vintage and rare postage stamps from different countries and eras",
        "is_public": True
    },
    {
        "name": "Sketches & Illustrations",
        "description": "Original sketches, drawings, and illustrations by various artists",
        "is_public": True
    },
    {
        "name": "Sports Keepsakes",
        "description": "Sports memorabilia, trading cards, and athletic collectibles",
        "is_public": True
    },
    {
        "name": "Vintage Electronics",
        "description": "Classic electronic devices, gadgets, and technological artifacts",
        "is_public": True
    },
    {
        "name": "Postcards & Ephemera",
        "description": "Vintage postcards, tickets, programs, and other paper collectibles",
        "is_public": True
    },
    {
        "name": "Antiques & Collectibles",
        "description": "General antiques and miscellaneous collectible items",
        "is_public": True
    },
    {
        "name": "Personal Treasures",
        "description": "Personal items with sentimental value and family heirlooms",
        "is_public": False  # This one might be more personal, so not public by default
    }
]


def get_admin_user(session: Session) -> User | None:
    """Get the first superuser from the database."""
    return session.exec(select(User).where(User.is_superuser == True)).first()


def seed_collections(session: Session) -> None:
    """Seed the database with predefined collections."""
    
    # Get an admin user to create the collections
    admin_user = get_admin_user(session)
    if not admin_user:
        logger.error("No admin user found. Please create an admin user first.")
        return
    
    logger.info(f"Using admin user: {admin_user.email}")
    
    collections_created = 0
    collections_skipped = 0
    
    for collection_data in COLLECTIONS:
        # Check if collection already exists
        existing_collection = session.exec(
            select(Collection).where(Collection.name == collection_data["name"])
        ).first()
        
        if existing_collection:
            logger.info(f"Collection '{collection_data['name']}' already exists, skipping...")
            collections_skipped += 1
            continue
        
        # Create new collection
        collection = Collection(
            name=collection_data["name"],
            description=collection_data["description"],
            is_public=collection_data["is_public"],
            created_by=admin_user.id
        )
        
        session.add(collection)
        collections_created += 1
        logger.info(f"Created collection: {collection_data['name']}")
    
    session.commit()
    
    logger.info(f"Collections seeding completed:")
    logger.info(f"  - Created: {collections_created}")
    logger.info(f"  - Skipped (already exist): {collections_skipped}")
    logger.info(f"  - Total collections in data: {len(COLLECTIONS)}")


def main() -> None:
    """Main function to run the collections seeding."""
    logger.info("Starting collections seeding...")
    
    try:
        with Session(engine) as session:
            seed_collections(session)
        logger.info("Collections seeding completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during collections seeding: {e}")
        raise


if __name__ == "__main__":
    main()
