from __future__ import annotations

import os
from fastapi import Depends, FastAPI, HTTPException
import uvicorn

from advisor import analyze_proposal_with_advisor
from jobs import JobManager, get_manager
from normative import NormativeRequest, NormativeResponse, default_retriever
from models import (
    AcademicAdvisorResponse,
    AdvisorAnalyzeRequest,
    SolveJobStarted,
    SolveJobStatus,
    SolveScheduleRequest,
    SolveScheduleResponse,
)
from solver import solve_academic_schedule

app = FastAPI(
    title="SUM Academic Planning Engine (CP-SAT + Hybrid AI Advisor)",
    version="1.0.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "ortools-cpsat-v1"}


@app.post("/v1/normative/query", response_model=NormativeResponse)
def normative_endpoint(request: NormativeRequest) -> NormativeResponse:
    return default_retriever().query(request)


@app.post("/v1/solve", response_model=SolveScheduleResponse)
def solve_endpoint(request: SolveScheduleRequest) -> SolveScheduleResponse:
    return solve_academic_schedule(request)


@app.post("/v1/solve-jobs", response_model=SolveJobStarted, status_code=202)
def start_solve_job(
    request: SolveScheduleRequest, manager: JobManager = Depends(get_manager)
) -> SolveJobStarted:
    job = manager.start(request)
    return SolveJobStarted(jobId=job.id, state="running", budgetSeconds=job.budget)


@app.get("/v1/solve-jobs/{job_id}", response_model=SolveJobStatus)
def get_solve_job(job_id: str, manager: JobManager = Depends(get_manager)) -> SolveJobStatus:
    status = manager.status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Unknown or expired solve job")
    return status


@app.delete("/v1/solve-jobs/{job_id}", response_model=SolveJobStatus)
def cancel_solve_job(job_id: str, manager: JobManager = Depends(get_manager)) -> SolveJobStatus:
    status = manager.cancel(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Unknown or expired solve job")
    return status


@app.post(
    "/v1/advisor",
    response_model=AcademicAdvisorResponse,
    response_model_exclude_none=False,
)
async def advisor_endpoint(
    request: AdvisorAnalyzeRequest,
) -> AcademicAdvisorResponse:
    try:
        return await analyze_proposal_with_advisor(request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3220"))
    uvicorn.run(app, host="127.0.0.1", port=port)
