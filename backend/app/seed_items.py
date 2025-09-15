#!/usr/bin/env python3
"""
Script to seed the database with items from the db_backups folder.
"""

import logging
import os
import shutil
import uuid
from pathlib import Path
from PIL import Image
from sqlmodel import Session, select

from app.core.db import engine
from app.core.config import settings
from app.models import Collection, Item, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mapping from db_backups folder names to collection names
FOLDER_TO_COLLECTION_MAPPING = {
    "models_&_statues": "Models & Statues",
    "coins_&_currency": "Coins & Currency", 
    "stamps": "Stamps",
    "sketches_&_illustrations": "Sketches & Illustrations",
    "sports_keepsakes": "Sports Keepsakes",
    "vintage_electronics": "Vintage Electronics",
    "postcards_&_ephemera": "Postcards & Ephemera",
    "antiques_&_collectibles": "Antiques & Collectibles",
    "personal_treasures": "Personal Treasures"
}

# Supported image extensions
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}


def get_admin_user(session: Session) -> User | None:
    """Get the first superuser from the database."""
    return session.exec(select(User).where(User.is_superuser == True)).first()


def get_collection_by_name(session: Session, collection_name: str) -> Collection | None:
    """Get a collection by its name."""
    return session.exec(select(Collection).where(Collection.name == collection_name)).first()


def get_image_metadata(file_path: str) -> tuple[int | None, int | None, str]:
    """
    Get image metadata including dimensions and MIME type.
    Returns (width, height, mime_type)
    """
    try:
        with Image.open(file_path) as img:
            width, height = img.size
            # Map PIL format to MIME type
            format_to_mime = {
                'JPEG': 'image/jpeg',
                'PNG': 'image/png',
                'GIF': 'image/gif',
                'BMP': 'image/bmp',
                'WEBP': 'image/webp',
                'TIFF': 'image/tiff'
            }
            mime_type = format_to_mime.get(img.format, 'image/jpeg')
            return width, height, mime_type
    except Exception as e:
        logger.warning(f"Could not get metadata for {file_path}: {e}")
        # Default fallback based on file extension
        ext = Path(file_path).suffix.lower()
        if ext in ['.jpg', '.jpeg']:
            return None, None, 'image/jpeg'
        elif ext == '.png':
            return None, None, 'image/png'
        elif ext == '.gif':
            return None, None, 'image/gif'
        else:
            return None, None, 'image/jpeg'


def generate_title_from_filename(filename: str) -> str:
    """Generate a human-readable title from filename."""
    # Remove extension and replace underscores/hyphens with spaces
    name = Path(filename).stem
    title = name.replace('_', ' ').replace('-', ' ')
    # Capitalize each word
    title = ' '.join(word.capitalize() for word in title.split())
    return title


def copy_image_to_storage(source_path: str, collection: Collection) -> str:
    """
    Copy image from db_backups to the proper storage location.
    Returns the destination file path.
    """
    # Generate unique filename
    file_extension = Path(source_path).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create collection directory
    collection_dir = f"{settings.IMAGE_STORAGE_PATH}/{collection.name.replace(' ', '_').lower()}"
    os.makedirs(collection_dir, exist_ok=True)
    
    # Destination path
    dest_path = f"{collection_dir}/{unique_filename}"
    
    # Copy file
    shutil.copy2(source_path, dest_path)
    logger.debug(f"Copied {source_path} -> {dest_path}")
    
    return dest_path


def seed_items_from_folder(session: Session, admin_user: User, db_backups_path: str) -> None:
    """Seed items from the db_backups folder."""
    
    items_created = 0
    items_skipped = 0
    errors = 0
    
    # Process each folder in db_backups
    for folder_name in os.listdir(db_backups_path):
        folder_path = os.path.join(db_backups_path, folder_name)
        
        if not os.path.isdir(folder_path):
            continue
            
        # Get corresponding collection
        collection_name = FOLDER_TO_COLLECTION_MAPPING.get(folder_name)
        if not collection_name:
            logger.warning(f"No collection mapping found for folder: {folder_name}")
            continue
            
        collection = get_collection_by_name(session, collection_name)
        if not collection:
            logger.error(f"Collection '{collection_name}' not found in database. Please run seed_collections.py first.")
            continue
            
        logger.info(f"Processing folder '{folder_name}' -> Collection '{collection_name}'")
        
        # Process each image in the folder
        for filename in os.listdir(folder_path):
            file_path = os.path.join(folder_path, filename)
            
            if not os.path.isfile(file_path):
                continue
                
            # Check if it's a supported image file
            file_extension = Path(filename).suffix.lower()
            if file_extension not in SUPPORTED_EXTENSIONS:
                logger.debug(f"Skipping non-image file: {filename}")
                continue
            
            try:
                # Check if item already exists (by filename in this collection)
                existing_item = session.exec(
                    select(Item).where(
                        Item.filename == filename,
                        Item.collection_id == collection.id
                    )
                ).first()
                
                if existing_item:
                    logger.debug(f"Item '{filename}' already exists in collection '{collection_name}', skipping...")
                    items_skipped += 1
                    continue
                
                # Copy image to storage
                storage_path = copy_image_to_storage(file_path, collection)
                
                # Get image metadata
                width, height, mime_type = get_image_metadata(storage_path)
                
                # Get file size
                file_size = os.path.getsize(storage_path)
                
                # Generate title
                title = generate_title_from_filename(filename)
                
                # Create item
                item_data = {
                    "title": title,
                    "description": f"Item from {collection_name} collection",
                    "filename": filename,
                    "file_path": storage_path,
                    "file_size": file_size,
                    "mime_type": mime_type,
                    "width": width,
                    "height": height,
                    "alt_text": f"{title} from {collection_name}",
                    "owner_id": admin_user.id,
                    "collection_id": collection.id
                }
                
                item = Item.model_validate(item_data)
                session.add(item)
                items_created += 1
                
                logger.info(f"Created item: {title} ({filename})")
                
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                errors += 1
                continue
    
    # Commit all changes
    try:
        session.commit()
        logger.info("All items committed to database successfully!")
    except Exception as e:
        logger.error(f"Error committing to database: {e}")
        session.rollback()
        raise
    
    logger.info(f"Items seeding completed:")
    logger.info(f"  - Created: {items_created}")
    logger.info(f"  - Skipped (already exist): {items_skipped}")
    logger.info(f"  - Errors: {errors}")


def main() -> None:
    """Main function to run the items seeding."""
    logger.info("Starting items seeding...")
    
    # Check if db_backups folder exists
    db_backups_path = "db_backups"
    if not os.path.exists(db_backups_path):
        logger.error(f"db_backups folder not found at: {os.path.abspath(db_backups_path)}")
        logger.error("Please make sure the db_backups folder exists in the backend directory.")
        return
    
    try:
        with Session(engine) as session:
            # Get admin user
            admin_user = get_admin_user(session)
            if not admin_user:
                logger.error("No admin user found. Please create an admin user first.")
                return
            
            logger.info(f"Using admin user: {admin_user.email}")
            
            # Create media storage directory if it doesn't exist
            os.makedirs(settings.IMAGE_STORAGE_PATH, exist_ok=True)
            logger.info(f"Media storage path: {os.path.abspath(settings.IMAGE_STORAGE_PATH)}")
            
            # Seed items
            seed_items_from_folder(session, admin_user, db_backups_path)
            
        logger.info("Items seeding completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during items seeding: {e}")
        raise


if __name__ == "__main__":
    main()
