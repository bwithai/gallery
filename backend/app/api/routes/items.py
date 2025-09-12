import os
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlmodel import func, select
from PIL import Image

from app.api.deps import CurrentUser, SessionDep
from app.models import Item, ItemCreate, ItemPublic, ItemsPublic, ItemUpdate, Message, Collection

from app.core.config import settings

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=ItemsPublic)
def read_items(
    session: SessionDep, 
    current_user: CurrentUser, 
    skip: int = 0, 
    limit: int = 100,
    collection_id: int | None = None
) -> Any:
    """
    Retrieve items from gallery.
    Admin sees all images, users see only their own images.
    Optionally filter by collection_id.
    """
    base_query = select(Item)
    count_query = select(func.count()).select_from(Item)
    
    # Add collection filter if specified
    if collection_id:
        base_query = base_query.where(Item.collection_id == collection_id)
        count_query = count_query.where(Item.collection_id == collection_id)
    
    if current_user.is_superuser:
        # Admin sees all images
        count = session.exec(count_query).one()
        statement = base_query.offset(skip).limit(limit).order_by(Item.upload_date.desc())
        items = session.exec(statement).all()
    else:
        # Users see only their own images
        user_filter = Item.owner_id == current_user.id
        count_query = count_query.where(user_filter)
        count = session.exec(count_query).one()
        
        statement = (
            base_query
            .where(user_filter)
            .offset(skip)
            .limit(limit)
            .order_by(Item.upload_date.desc())
        )
        items = session.exec(statement).all()

    return ItemsPublic(data=items, count=count)


@router.get("/{id}", response_model=ItemPublic)
def read_item(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get image by ID.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Check permissions: admin, owner, or image in public collection
    collection = session.get(Collection, item.collection_id)
    if not (current_user.is_superuser or 
            item.owner_id == current_user.id or 
            (collection and collection.is_public)):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return item


@router.post("/upload", response_model=ItemPublic)
async def upload_image(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str | None = Form(None),
    alt_text: str | None = Form(None),
    veneration: str | None = Form(None),
    commission_date: str | None = Form(None),  # Will parse to datetime
    owned_since: str | None = Form(None),  # Will parse to datetime
    monitory_value: float | None = Form(None),
    collection_id: int = Form(...)
) -> Any:
    """
    Upload a new image to the gallery.
    Users can upload images to any available collection.
    """
    # Validate collection exists and user has access
    collection = session.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check if user can access this collection (public collections or admin)
    if not (current_user.is_superuser or collection.is_public or collection.created_by == current_user.id):
        raise HTTPException(status_code=403, detail="Cannot upload to this collection")
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename or "")[1] or ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create collection directory if it doesn't exist
    collection_dir = f"{settings.IMAGE_STORAGE_PATH}/{collection.name.replace(' ', '_').lower()}"
    os.makedirs(collection_dir, exist_ok=True)
    
    # Save file
    file_path = f"{collection_dir}/{unique_filename}"
    
    try:
        # Read and save file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Get image dimensions
        width, height = None, None
        try:
            with Image.open(file_path) as img:
                width, height = img.size
        except Exception:
            pass  # Continue without dimensions if PIL fails
        
        # Parse datetime fields
        parsed_commission_date = None
        if commission_date:
            try:
                parsed_commission_date = datetime.fromisoformat(commission_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid commission_date format. Use ISO format.")
        
        parsed_owned_since = None
        if owned_since:
            try:
                parsed_owned_since = datetime.fromisoformat(owned_since.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid owned_since format. Use ISO format.")
        
        # Create database record
        item_data = {
            "title": title,
            "description": description,
            "veneration": veneration,
            "commission_date": parsed_commission_date,
            "owned_since": parsed_owned_since,
            "monitory_value": monitory_value,
            "filename": file.filename or unique_filename,
            "file_path": file_path,
            "file_size": len(contents),
            "mime_type": file.content_type,
            "width": width,
            "height": height,
            "alt_text": alt_text,
            "owner_id": current_user.id,
            "collection_id": collection_id
        }
        
        item = Item.model_validate(item_data)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item
        
    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@router.put("/{id}", response_model=ItemPublic)
async def update_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    file: UploadFile | None = File(None),
    title: str | None = Form(None),
    description: str | None = Form(None),
    alt_text: str | None = Form(None),
    veneration: str | None = Form(None),
    commission_date: str | None = Form(None),
    owned_since: str | None = Form(None),
    monitory_value: float | None = Form(None),
    collection_id: int | None = Form(None)
) -> Any:
    """
    Update image metadata and optionally replace the image file.
    Users can only update their own images.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Only owner or admin can update
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # If changing collection, validate new collection exists and is accessible
    if collection_id is not None:
        new_collection = session.get(Collection, collection_id)
        if not new_collection:
            raise HTTPException(status_code=404, detail="Target collection not found")
        
        # Check if user can move image to this collection
        if not (current_user.is_superuser or new_collection.is_public or new_collection.created_by == current_user.id):
            raise HTTPException(status_code=403, detail="Cannot move image to this collection")
    
    # Prepare update data
    update_data = {}
    
    # Handle optional fields
    if title is not None:
        update_data["title"] = title
    if description is not None:
        update_data["description"] = description
    if alt_text is not None:
        update_data["alt_text"] = alt_text
    if veneration is not None:
        update_data["veneration"] = veneration
    if monitory_value is not None:
        update_data["monitory_value"] = monitory_value
    if collection_id is not None:
        update_data["collection_id"] = collection_id
    
    # Parse datetime fields
    if commission_date is not None:
        try:
            update_data["commission_date"] = datetime.fromisoformat(commission_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid commission_date format. Use ISO format.")
    
    if owned_since is not None:
        try:
            update_data["owned_since"] = datetime.fromisoformat(owned_since.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid owned_since format. Use ISO format.")
    
    # Handle image file replacement
    if file is not None:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename or "")[1] or ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Get collection for directory path
        collection = session.get(Collection, item.collection_id)
        if collection_id:
            collection = session.get(Collection, collection_id)
        
        # Create collection directory if it doesn't exist
        collection_dir = f"{settings.IMAGE_STORAGE_PATH}/{collection.name.replace(' ', '_').lower()}"
        os.makedirs(collection_dir, exist_ok=True)
        
        # New file path
        new_file_path = f"{collection_dir}/{unique_filename}"
        
        try:
            # Read and save new file
            contents = await file.read()
            with open(new_file_path, "wb") as f:
                f.write(contents)
            
            # Get image dimensions
            width, height = None, None
            try:
                with Image.open(new_file_path) as img:
                    width, height = img.size
            except Exception:
                pass  # Continue without dimensions if PIL fails
            
            # Delete old file
            if os.path.exists(item.file_path):
                try:
                    os.remove(item.file_path)
                except Exception:
                    pass  # Continue even if old file deletion fails
            
            # Update file-related fields
            update_data.update({
                "filename": file.filename or unique_filename,
                "file_path": new_file_path,
                "file_size": len(contents),
                "mime_type": file.content_type,
                "width": width,
                "height": height,
            })
            
        except Exception as e:
            # Clean up new file if something fails
            if os.path.exists(new_file_path):
                os.remove(new_file_path)
            raise HTTPException(status_code=500, detail=f"Failed to update image: {str(e)}")
    
    # Apply updates
    if update_data:
        item.sqlmodel_update(update_data)
        session.add(item)
        session.commit()
        session.refresh(item)
    
    return item


@router.patch("/{id}", response_model=ItemPublic)
def update_item_metadata(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    item_in: ItemUpdate,
) -> Any:
    """
    Update image metadata only (no file replacement).
    Users can only update their own images.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Only owner or admin can update
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # If changing collection, validate new collection exists and is accessible
    update_dict = item_in.model_dump(exclude_unset=True)
    if "collection_id" in update_dict:
        new_collection = session.get(Collection, update_dict["collection_id"])
        if not new_collection:
            raise HTTPException(status_code=404, detail="Target collection not found")
        
        # Check if user can move image to this collection
        if not (current_user.is_superuser or new_collection.is_public or new_collection.created_by == current_user.id):
            raise HTTPException(status_code=403, detail="Cannot move image to this collection")
    
    item.sqlmodel_update(update_dict)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{id}")
def delete_item(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete an image.
    Users can only delete their own images.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Only owner or admin can delete
    if not current_user.is_superuser and (item.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Delete file from filesystem
    if os.path.exists(item.file_path):
        try:
            os.remove(item.file_path)
        except Exception:
            pass  # Continue with database deletion even if file deletion fails
    
    session.delete(item)
    session.commit()
    return Message(message="Image deleted successfully")


@router.get("/{id}/image")
def get_image_file(session: SessionDep, current_user: CurrentUser, id: int):
    """
    Serve the actual image file.
    """
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Check permissions: admin, owner, or image in public collection
    collection = session.get(Collection, item.collection_id)
    if not (current_user.is_superuser or 
            item.owner_id == current_user.id or 
            (collection and collection.is_public)):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Check if file exists
    if not os.path.exists(item.file_path):
        raise HTTPException(status_code=404, detail="Image file not found on server")
    
    return FileResponse(
        path=item.file_path,
        media_type=item.mime_type,
        filename=item.filename
    )
