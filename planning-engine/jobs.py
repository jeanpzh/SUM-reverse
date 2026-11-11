"""PA-ENGINE-JOBS-1: one in-memory background search, polled over HTTP.

The search runs in a separate worker process, so the HTTP server stays responsive and
cancelling kills the CPU work immediately instead of setting a flag. Jobs live in this
process's memory only: nothing is written to disk and an engine restart loses them.
Teacher names and ids are never logged here; only job ids and exception class names are.
"""
from __future__ import annotations

import logging
import multiprocessing
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from models import (
    AssignmentOutput,
    DiagnosticOutput,
    SolveJobError,
    SolveJobProgress,
    SolveJobStatus,
    SolveScheduleRequest,
    SolveScheduleResponse,
)

log = logging.getLogger('planning-engine.jobs')

TERMINAL_RETENTION_SECONDS = 15 * 60
MAX_TERMINAL_JOBS = 20
POLL_SECONDS = 0.05
WORKER_NICE = 5  # Leaves CPU to the HTTP server while the search uses every allowed core.

ERROR_MESSAGES = {
    'SEARCH_FAILED': 'La búsqueda terminó con un error interno; no hay horario que reportar',
    'SEARCH_PROCESS_LOST': 'El proceso de búsqueda terminó inesperadamente; no hay horario que reportar',
    'SEARCH_OVERRUN': 'La búsqueda superó con creces su presupuesto y fue detenida; no hay horario que reportar',
}


def run_search(conn, request_json: str) -> None:
    """Default worker body: validate, search with progress hooks, send the final response."""
    from solver import SearchHooks, solve_academic_schedule

    request = SolveScheduleRequest.model_validate_json(request_json)
    conn.send(('started',))
    hooks = SearchHooks(
        on_phase=lambda name: conn.send(('phase', name)),
        on_improvement=lambda assignments: conn.send(('best', [a.model_dump() for a in assignments])),
    )
    conn.send(('done', solve_academic_schedule(request, hooks).model_dump_json()))


def _child_main(target: Callable[[Any, str], None], conn, request_json: str) -> None:
    try:
        os.nice(WORKER_NICE)
    except OSError:
        pass
    try:
        target(conn, request_json)
    except BaseException as error:  # noqa: BLE001 - report a stable code, never the message
        conn.send(('error', type(error).__name__))
    finally:
        conn.close()


def _mp_context():
    if 'forkserver' in multiprocessing.get_all_start_methods():
        context = multiprocessing.get_context('forkserver')
        context.set_forkserver_preload(['solver'])  # Workers fork with ortools already imported.
        return context
    return multiprocessing.get_context('spawn')


@dataclass
class Job:
    id: str
    budget: float
    fingerprint: str
    correlated: bool
    requirement_ids: list[str]
    required_sections: int
    request_json: str | None
    created: float
    state: str = 'running'
    phase: str = 'preparing'
    search_started: float | None = None
    ended: float | None = None
    best: list[dict] | None = None
    improvements: int = 0
    result: SolveScheduleResponse | None = None
    error: SolveJobError | None = None
    process: Any = None
    thread: threading.Thread | None = field(default=None, repr=False)


class JobManager:
    def __init__(self, search_target: Callable[[Any, str], None] = run_search,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.search_target = search_target
        self.clock = clock
        self.max_terminal_jobs = MAX_TERMINAL_JOBS
        self.retention_seconds = TERMINAL_RETENTION_SECONDS
        self._jobs: dict[str, Job] = {}
        self._lock = threading.RLock()
        self._fences: dict[str, float] = {}
        self._closed = False

    # -- public interface -------------------------------------------------------------
    def start(self, request: SolveScheduleRequest, job_id: str | None = None) -> Job:
        with self._lock:
            self._prune()
            if self._closed:
                raise RuntimeError('Manager closed')
            fingerprint = request.model_dump_json()
            if job_id in self._jobs:
                existing = self._jobs[job_id]
                if existing.fingerprint != fingerprint:
                    raise ValueError('Correlation payload conflict')
                return existing
            if job_id in self._fences:
                raise ValueError('Correlation cancelled before start')
            if len(self._fences) + len(self._jobs) >= 256:
                raise OverflowError('Correlation capacity')
            for job in self._jobs.values():
                if job.state == 'running':
                    self._cancel(job)
            job = Job(id=job_id or uuid.uuid4().hex, budget=request.maxTimeSeconds, fingerprint=fingerprint, correlated=job_id is not None,
                      requirement_ids=[r.id for r in request.requirements],
                      required_sections=len({r.sectionId for r in request.requirements}),
                      request_json=request.model_dump_json(), created=self.clock())
            self._jobs[job.id] = job
            job.thread = threading.Thread(target=self._monitor, args=(job,), daemon=True, name=f'solve-job-{job.id[:8]}')
            job.thread.start()
            return job

    def status(self, job_id: str) -> SolveJobStatus | None:
        with self._lock:
            self._prune()
            job = self._jobs.get(job_id)
            return None if job is None else self._snapshot(job)

    def cancel(self, job_id: str) -> SolveJobStatus | None:
        with self._lock:
            self._prune()
            job = self._jobs.get(job_id)
            if job is None:
                if job_id not in self._fences:
                    if len(self._fences) + len(self._jobs) >= 256:
                        raise OverflowError('Correlation capacity')
                    self._fences[job_id] = self.clock()
                return None
            if job.state == 'running':
                self._cancel(job)
            return self._snapshot(job)

    def process_of(self, job_id: str):
        with self._lock:
            return self._jobs[job_id].process

    def shutdown(self) -> None:
        with self._lock:
            self._closed = True
            for job in self._jobs.values():
                if job.state == 'running':
                    self._cancel(job)
            threads = [job.thread for job in self._jobs.values() if job.thread is not None]
        for thread in threads:
            thread.join(2.0)

    # -- state transitions (call with the lock held) ---------------------------------------
    def _cancel(self, job: Job) -> None:
        job.state = 'cancelled'
        job.ended = self.clock()
        job.result = self._partial_result(job)
        if job.process is not None:
            job.process.kill()  # SIGKILL: the CP-SAT threads die with the process

    def _fail(self, job: Job, code: str) -> None:
        job.state = 'failed'
        job.ended = self.clock()
        job.result = None
        job.error = SolveJobError(code=code, message=ERROR_MESSAGES[code])
        log.warning('solve job %s failed: %s', job.id, code)
        if job.process is not None and job.process.is_alive():
            job.process.kill()

    def _partial_result(self, job: Job) -> SolveScheduleResponse | None:
        if not job.best:
            return None
        assignments = [AssignmentOutput.model_validate(a) for a in job.best]
        assigned = {a.id for a in assignments}
        missing = [rid for rid in job.requirement_ids if rid not in assigned]
        complete = not missing
        return SolveScheduleResponse(
            status='complete' if complete else 'search-limit', assignments=assignments,
            exploredCandidates=0, candidateVisits=0, backtracks=0, limitReason=None if complete else job.state,
            coverageProof='complete' if complete else 'inconclusive',
            diagnostics=[DiagnosticOutput(code='SEARCH_CANCELLED' if job.state == 'cancelled' else 'SEARCH_RUNNING', sessionIds=missing,
                message='Se conserva el mejor horario factible; la búsqueda ' + ('fue cancelada' if job.state == 'cancelled' else 'continúa'))])

    def _prune(self) -> None:
        now = self.clock()
        self._fences = {key: at for key, at in self._fences.items() if now - at <= self.retention_seconds}
        terminal = sorted((j for j in self._jobs.values() if j.state != 'running'), key=lambda j: j.ended or 0)
        for job in terminal:
            if now - (job.ended or now) > self.retention_seconds:
                self._fences[job.id] = now
                del self._jobs[job.id]
        terminal = [j for j in terminal if j.id in self._jobs]
        for job in [j for j in terminal if not j.correlated][:max(0, len(terminal) - self.max_terminal_jobs)]:
            self._fences[job.id] = now
            del self._jobs[job.id]

    def _snapshot(self, job: Job) -> SolveJobStatus:
        best = job.result.assignments if job.state == 'completed' and job.result else job.best
        assignments = best or []
        sessions = len(assignments)
        sections = len({a.sectionId if isinstance(a, AssignmentOutput) else a['sectionId'] for a in assignments})
        elapsed = 0.0 if job.search_started is None else (job.ended or self.clock()) - job.search_started
        return SolveJobStatus(
            jobId=job.id, state=job.state, phase='done' if job.state == 'completed' else job.phase,
            elapsedSeconds=round(max(0.0, elapsed), 3), budgetSeconds=job.budget,
            progress=SolveJobProgress(requiredSessions=len(job.requirement_ids), scheduledSessions=sessions,
                requiredSections=job.required_sections, scheduledSections=sections, improvements=job.improvements),
            result=self._partial_result(job) if job.state == 'running' else job.result, error=job.error)

    # -- worker supervision ------------------------------------------------------------------
    def _monitor(self, job: Job) -> None:
        process = None
        reader = None
        try:
            context = _mp_context()
            reader, writer = context.Pipe(duplex=False)
            process = context.Process(target=_child_main, args=(self.search_target, writer, job.request_json),
                                      daemon=True, name=f'solve-search-{job.id[:8]}')
            process.start()
            writer.close()
            with self._lock:
                job.request_json = None
                job.process = process
                if job.state != 'running':
                    process.kill()  # Cancelled while the worker was starting
            while True:
                with self._lock:
                    if job.state != 'running':
                        return
                if reader.poll(POLL_SECONDS):
                    try:
                        message = reader.recv()
                    except (EOFError, OSError):
                        message = None
                    with self._lock:
                        if job.state != 'running':
                            return
                        if message is None:
                            self._fail(job, 'SEARCH_PROCESS_LOST')
                            return
                        self._handle(job, message)
                        if job.state != 'running':
                            return
                elif not process.is_alive():
                    if reader.poll(0):
                        continue
                    with self._lock:
                        if job.state == 'running':
                            self._fail(job, 'SEARCH_PROCESS_LOST')
                    return
                elif self.clock() - job.created > job.budget * 1.5 + 20:
                    with self._lock:
                        if job.state == 'running':
                            self._fail(job, 'SEARCH_OVERRUN')
                    return
        except Exception as error:  # noqa: BLE001
            log.warning('solve job %s supervision error: %s', job.id, type(error).__name__)
            with self._lock:
                if job.state == 'running':
                    self._fail(job, 'SEARCH_FAILED')
        finally:
            if process is not None:
                if process.is_alive():
                    process.kill()
                process.join(5.0)
            if reader is not None:
                reader.close()

    def _handle(self, job: Job, message: tuple) -> None:
        kind = message[0]
        if kind == 'started':
            job.search_started = self.clock()
        elif kind == 'phase':
            job.phase = message[1]
        elif kind == 'best':
            job.best = message[1]
            job.improvements += 1
        elif kind == 'done':
            result = SolveScheduleResponse.model_validate_json(message[1])
            job.result = result
            job.state = 'completed'
            job.phase = 'done'
            job.ended = self.clock()
        elif kind == 'error':
            self._fail(job, 'SEARCH_FAILED')


_manager: JobManager | None = None
_manager_lock = threading.Lock()


def get_manager() -> JobManager:
    global _manager
    with _manager_lock:
        if _manager is None:
            _manager = JobManager()
        return _manager
