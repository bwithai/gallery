from datetime import datetime
from pydantic import EmailStr
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str = Field(nullable=False)
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    collections: list["Collection"] = Relationship(back_populates="creator", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: int


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Collection models
class CollectionBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    is_public: bool = Field(default=False)  # Whether collection is visible to all users


class CollectionCreate(CollectionBase):
    pass


class CollectionUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    is_public: bool | None = Field(default=None)


class Collection(CollectionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_by: int = Field(foreign_key="user.id", nullable=False)
    created_date: datetime = Field(default_factory=datetime.now, index=True)
    creator: User | None = Relationship(back_populates="collections")
    items: list["Item"] = Relationship(back_populates="collection")


class CollectionPublic(CollectionBase):
    id: int
    created_by: int
    created_date: datetime


class CollectionsPublic(SQLModel):
    data: list[CollectionPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    veneration: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    commission_date: datetime | None = Field(default=None)
    owned_since: datetime | None = Field(default=None)
    monitory_value: float | None = Field(default=None)
    # Image-specific fields
    filename: str = Field(max_length=255)
    file_path: str = Field(max_length=500)
    file_size: int = Field(gt=0)  # File size in bytes
    mime_type: str = Field(max_length=100)  # e.g., 'image/jpeg', 'image/png'
    width: int | None = Field(default=None, gt=0)  # Image width in pixels
    height: int | None = Field(default=None, gt=0)  # Image height in pixels
    alt_text: str | None = Field(default=None, max_length=500)  # Accessibility text


# Properties to receive on item creation
class ItemCreate(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    veneration: str | None = Field(default=None, max_length=255)
    commission_date: datetime | None = Field(default=None)
    owned_since: datetime | None = Field(default=None)
    monitory_value: float | None = Field(default=None)
    description: str | None = Field(default=None, max_length=1000)
    alt_text: str | None = Field(default=None, max_length=500)
    collection_id: int = Field(gt=0)  # Required: user must select a collection


# Properties to receive on item update
class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    veneration: str | None = Field(default=None, max_length=255)
    commission_date: datetime | None = Field(default=None)
    owned_since: datetime | None = Field(default=None)
    monitory_value: float | None = Field(default=None)
    description: str | None = Field(default=None, max_length=1000)
    alt_text: str | None = Field(default=None, max_length=500)
    collection_id: int | None = Field(default=None, gt=0)  # Allow moving to different collection


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    collection_id: int = Field(
        foreign_key="collection.id", nullable=False, ondelete="CASCADE"
    )
    upload_date: datetime = Field(default_factory=datetime.now, index=True)
    owner: User | None = Relationship(back_populates="items")
    collection: Collection | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: int
    owner_id: int
    collection_id: int
    upload_date: datetime


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)
