from __future__ import annotations

import os
from fastapi import FastAPI, HTTPException
import uvicorn

from advisor import analyze_proposal_with_advisor
from normative import NormativeRequest, NormativeResponse, default_retriever
from models import (
    AcademicAdvisorResponse,
    AdvisorAnalyzeRequest,
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
