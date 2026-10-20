from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from app.api.v1.auth import current_user
from app.db.session import get_db
from app.core.cache import rate_limit_check
from app.services.tinyfish import ResearchInput, create_research, owned_job, refresh_job

router = APIRouter()


@router.post('/research')
def research(body: ResearchInput, request: Request, user=Depends(current_user), db: Session = Depends(get_db)):
    if not rate_limit_check(f'research:{user.id}', 10, 60):
        raise HTTPException(429, 'Please wait a minute before researching again.')
    return create_research(db, body, user.id, request.client.host if request.client else 'unknown')


@router.get('/research/{job_id}')
def status(job_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    if not rate_limit_check(f'research-status:{user.id}', 60, 60):
        raise HTTPException(429, 'Please wait before checking again.')
    return refresh_job(db, owned_job(db, job_id, user.id))


@router.post('/research/{job_id}/cancel')
def cancel(job_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    if not rate_limit_check(f'research-cancel:{user.id}', 10, 60):
        raise HTTPException(429, 'Please wait before cancelling again.')
    return refresh_job(db, owned_job(db, job_id, user.id), cancel=True)
