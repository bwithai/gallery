#!/usr/bin/env python3
"""
Script to add a Favorites collection to the database.
Run this if you don't have a Favorites collection yet.
"""

import logging
from sqlmodel import Session, select

from app.core.db import engine
from app.models import Collection, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_admin_user(session: Session) -> User | None:
    """Get the first superuser from the database."""
    return session.exec(select(User).where(User.is_superuser == True)).first()


def add_favorites_collection(session: Session) -> None:
    """Add a Favorites collection to the database."""
    
    # Get an admin user to create the collection
    admin_user = get_admin_user(session)
    if not admin_user:
        logger.error("No admin user found. Please create an admin user first.")
        return
    
    logger.info(f"Using admin user: {admin_user.email}")
    
    # Check if Favorites collection already exists
    existing_collection = session.exec(
        select(Collection).where(Collection.name == "Favorites")
    ).first()
    
    if existing_collection:
        logger.info("Favorites collection already exists!")
        logger.info(f"Collection ID: {existing_collection.id}")
        logger.info(f"Created by: {existing_collection.created_by}")
        logger.info(f"Is public: {existing_collection.is_public}")
        return
    
    # Create new Favorites collection
    collection = Collection(
        name="Favorites",
        description="Your favorite items saved from other collections",
        is_public=False,  # Personal collection, not public
        created_by=admin_user.id
    )
    
    session.add(collection)
    session.commit()
    session.refresh(collection)
    
    logger.info(f"Created Favorites collection with ID: {collection.id}")
    logger.info("Favorites collection is ready for use!")


def main() -> None:
    """Main function to add the Favorites collection."""
    logger.info("Adding Favorites collection...")
    
    try:
        with Session(engine) as session:
            add_favorites_collection(session)
        logger.info("Favorites collection setup completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during Favorites collection setup: {e}")
        raise


if __name__ == "__main__":
    main()
