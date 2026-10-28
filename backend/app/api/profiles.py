"""API router for Profile Builder module (Owner: Aashish Kumar).

Endpoints:
- POST   /api/profiles            → Create a candidate profile
- GET    /api/profiles            → List candidate profiles
- GET    /api/profiles/{id}       → Retrieve a profile by ID
- PATCH  /api/profiles/{id}       → Update profile fields
- DELETE /api/profiles/{id}       → Delete a profile
"""

from typing import List
from fastapi import APIRouter, HTTPException, status
from app.schemas.contracts import Profile, ProfileUpdate
from app.db.profiles import profile_repository

router = APIRouter(tags=["Profile Builder"])


@router.post(
    "/profiles",
    response_model=Profile,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new candidate profile",
)
def create_profile(profile: Profile):
    """Creates a new candidate profile and persists it with a stable unique profile_id."""
    try:
        return profile_repository.create(profile)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while creating profile: {str(e)}",
        )


@router.get(
    "/profiles",
    response_model=List[Profile],
    summary="List all candidate profiles",
)
def list_profiles():
    """Returns all saved candidate profiles ordered by most recently updated."""
    try:
        return profile_repository.list_all()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while listing profiles: {str(e)}",
        )


@router.get(
    "/profiles/{profile_id}",
    response_model=Profile,
    summary="Retrieve a candidate profile by ID",
)
def get_profile(profile_id: str):
    """Retrieves a single candidate profile by its stable profile ID."""
    try:
        found = profile_repository.get_by_id(profile_id)
        if not found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile '{profile_id}' not found.",
            )
        return found
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while fetching profile: {str(e)}",
        )


@router.patch(
    "/profiles/{profile_id}",
    response_model=Profile,
    summary="Update an existing candidate profile",
)
def update_profile(profile_id: str, updates: ProfileUpdate):
    """Updates fields of an existing profile without altering its stable profile_id."""
    try:
        update_dict = updates.model_dump(exclude_unset=True)
        updated = profile_repository.update(profile_id, update_dict)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile '{profile_id}' not found.",
            )
        return updated
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while updating profile: {str(e)}",
        )


@router.delete(
    "/profiles/{profile_id}",
    summary="Delete a candidate profile",
)
def delete_profile(profile_id: str):
    """Deletes a candidate profile by its stable ID."""
    try:
        deleted = profile_repository.delete(profile_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile '{profile_id}' not found.",
            )
        return {"status": "deleted", "profile_id": profile_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while deleting profile: {str(e)}",
        )
