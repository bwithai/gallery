from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Collection, CollectionCreate, CollectionPublic, CollectionsPublic, CollectionUpdate, Message

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/", response_model=CollectionsPublic)
def read_collections(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve collections.
    Admin sees all collections, users see only public collections and their own.
    """
    if current_user.is_superuser:
        # Admin sees all collections
        count_statement = select(func.count()).select_from(Collection)
        count = session.exec(count_statement).one()
        statement = select(Collection).offset(skip).limit(limit).order_by(Collection.created_date.desc())
        collections = session.exec(statement).all()
    else:
        # Users see public collections and their own collections
        count_statement = (
            select(func.count())
            .select_from(Collection)
            .where(
                (Collection.is_public == True) | (Collection.created_by == current_user.id)
            )
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Collection)
            .where(
                (Collection.is_public == True) | (Collection.created_by == current_user.id)
            )
            .offset(skip)
            .limit(limit)
            .order_by(Collection.created_date.desc())
        )
        collections = session.exec(statement).all()

    return CollectionsPublic(data=collections, count=count)


@router.get("/{id}", response_model=CollectionPublic)
def read_collection(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get collection by ID.
    """
    collection = session.get(Collection, id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check permissions: admin, creator, or public collection
    if not (current_user.is_superuser or 
            collection.created_by == current_user.id or 
            collection.is_public):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return collection


@router.post("/", response_model=CollectionPublic)
def create_collection(
    *, session: SessionDep, current_user: CurrentUser, collection_in: CollectionCreate
) -> Any:
    """
    Create new collection.
    Only admins can create collections.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only administrators can create collections")
    
    collection = Collection.model_validate(collection_in, update={"created_by": current_user.id})
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


@router.put("/{id}", response_model=CollectionPublic)
def update_collection(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    collection_in: CollectionUpdate,
) -> Any:
    """
    Update a collection.
    Only admins can update collections.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only administrators can update collections")
    
    collection = session.get(Collection, id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    update_dict = collection_in.model_dump(exclude_unset=True)
    collection.sqlmodel_update(update_dict)
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


@router.delete("/{id}")
def delete_collection(
    session: SessionDep, current_user: CurrentUser, id: int
) -> Message:
    """
    Delete a collection.
    Only admins can delete collections.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only administrators can delete collections")
    
    collection = session.get(Collection, id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    session.delete(collection)
    session.commit()
    return Message(message="Collection deleted successfully")
