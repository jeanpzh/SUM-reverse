"""PA-ENGINE-JOBS-1 acceptance through the HTTP interface; synthetic fixtures only.

The search runs in a child process, so failure injection replaces the manager's
`search_target` with an importable module-level function instead of patching solver
internals in this process.
"""
from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

import jobs
from main import app
from models import SolveScheduleRequest, SolveScheduleResponse
from solver import solve_academic_schedule
from test_solver_scale import assert_hard_constraints, scale_request  # noqa: F401  (fixture)

PHASES = {'preparing', 'capacity', 'coverage', 'prelation', 'preferences', 'done'}
STATES = {'running', 'completed', 'cancelled', 'failed'}


@pytest.fixture
def manager():
    mgr = jobs.JobManager()
    app.dependency_overrides[jobs.get_manager] = lambda: mgr
    yield mgr
    mgr.shutdown()
    app.dependency_overrides.clear()


@pytest.fixture
def client(manager):
    return TestClient(app)


def small_request(budget=2.0, sections=2) -> SolveScheduleRequest:
    windows = [dict(day=d, startMinute=480, endMinute=1200) for d in range(1, 6)]
    secs = [dict(id=f'S{i}', courseId='X', capacity=10, cycle=3, ordinal=i + 1) for i in range(sections)]
    return SolveScheduleRequest.model_validate(dict(
        courses=[dict(courseId='X', estimatedDemand=10 * sections, targetCapacity=10, cycle=3,
                      weeklySessions=[dict(id='T', durationMinutes=120, type='T')])],
        sections=secs,
        requirements=[dict(id=s['id'] + '-T', sectionId=s['id'], courseId='X', durationMinutes=120, order=0, type='T')
                      for s in secs],
        teachers=[dict(id='A', courseIds=['X'], maxWeeklyMinutes=600, availability=windows)],
        rooms=[dict(id='R', capacity=10, availability=windows)],
        windows=windows, maxTimeSeconds=budget))


def post_job(client, req):
    response = client.post('/v1/solve-jobs', content=req.model_dump_json(), headers={'content-type': 'application/json'})
    assert response.status_code == 202, response.text
    return response.json()


def wait_terminal(client, job_id, timeout=20.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f'/v1/solve-jobs/{job_id}').json()
        if body['state'] != 'running':
            return body
        time.sleep(0.05)
    raise AssertionError('job did not reach a terminal state')


def test_small_job_completes_with_the_synchronous_result(client):
    req = small_request()
    started = post_job(client, req)
    assert started['state'] == 'running' and started['budgetSeconds'] == 2.0 and started['jobId']
    body = wait_terminal(client, started['jobId'])
    expected = solve_academic_schedule(req)
    assert body['state'] == 'completed' and body['phase'] == 'done' and body['error'] is None
    assert body['result']['status'] == expected.status == 'complete'
    assert body['result']['coverageProof'] == expected.coverageProof == 'complete'
    assert body['result']['capacityCertificate'] == expected.model_dump(mode='json')['capacityCertificate']
    assert body['result']['decisions'] == expected.model_dump(mode='json')['decisions']
    assert len(body['result']['assignments']) == len(expected.assignments)
    assert body['progress'] == dict(requiredSessions=2, scheduledSessions=2, requiredSections=2,
                                    scheduledSections=2, improvements=body['progress']['improvements'])
    assert body['progress']['improvements'] >= 1


def test_progress_is_monotonic_and_health_stays_responsive(client, scale_request):
    req = scale_request.model_copy(update={'maxTimeSeconds': 5.0})
    job_id = post_job(client, req)['jobId']
    last = (0, 0, 0)
    worst_health = 0.0
    seen_phases = set()
    body = None
    while True:
        started = time.monotonic()
        assert client.get('/health').json()['status'] == 'ok'
        worst_health = max(worst_health, time.monotonic() - started)
        body = client.get(f'/v1/solve-jobs/{job_id}').json()
        assert body['state'] in STATES and body['phase'] in PHASES
        seen_phases.add(body['phase'])
        progress = body['progress']
        assert progress['requiredSessions'] == 332 and progress['requiredSections'] == 166
        current = (progress['scheduledSessions'], progress['scheduledSections'], progress['improvements'])
        assert all(now >= before for now, before in zip(current, last)), (last, current)
        last = current
        if body['state'] != 'running':
            break
        assert body['result'] is None
        time.sleep(0.1)
    print(f'scale job: phases={sorted(seen_phases)} progress={last} worst /health={worst_health * 1000:.0f} ms')
    assert body['state'] == 'completed' and body['phase'] == 'done'
    assert worst_health < 0.3
    assert last[0] >= 100 and last[2] >= 1
    assert body['progress']['scheduledSessions'] == len(body['result']['assignments'])
    assert_hard_constraints(req, SolveScheduleResponse.model_validate(body['result']))


def test_cancel_stops_the_search_promptly_and_keeps_a_valid_schedule(client, manager, scale_request):
    req = scale_request.model_copy(update={'maxTimeSeconds': 60.0})
    job_id = post_job(client, req)['jobId']
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        body = client.get(f'/v1/solve-jobs/{job_id}').json()
        if body['progress']['scheduledSessions'] > 0:
            break
        time.sleep(0.05)
    assert body['state'] == 'running' and body['progress']['scheduledSessions'] > 0
    process = manager.process_of(job_id)
    started = time.monotonic()
    cancelled = client.delete(f'/v1/solve-jobs/{job_id}')
    took = time.monotonic() - started
    print(f'cancel took {took * 1000:.0f} ms')
    assert cancelled.status_code == 200 and took < 2.0
    body = cancelled.json()
    assert body['state'] == 'cancelled' and body['error'] is None
    assert body['result'] is not None and body['result']['coverageProof'] in ('inconclusive', 'complete')
    result = SolveScheduleResponse.model_validate(body['result'])
    assert_hard_constraints(req, result)
    assert len(result.assignments) == body['progress']['scheduledSessions']
    process.join(1.0)
    assert not process.is_alive()
    assert client.get(f'/v1/solve-jobs/{job_id}').json() == body


def test_starting_a_second_job_cancels_the_first(client, scale_request):
    first = post_job(client, scale_request.model_copy(update={'maxTimeSeconds': 60.0}))['jobId']
    time.sleep(0.5)
    second = post_job(client, small_request())['jobId']
    assert second != first
    one = client.get(f'/v1/solve-jobs/{first}').json()
    assert one['state'] == 'cancelled'
    two = wait_terminal(client, second)
    assert two['state'] == 'completed' and two['result']['status'] == 'complete'


def test_unknown_job_is_404_and_delete_of_a_terminal_job_is_a_no_op(client):
    assert client.get('/v1/solve-jobs/nope').status_code == 404
    assert client.delete('/v1/solve-jobs/nope').status_code == 404
    job_id = post_job(client, small_request())['jobId']
    done = wait_terminal(client, job_id)
    again = client.delete(f'/v1/solve-jobs/{job_id}')
    assert again.status_code == 200 and again.json() == done and done['state'] == 'completed'


def failing_search(conn, request_json):
    raise RuntimeError('boom: teacher A must never be echoed')


def test_failure_inside_the_search_reports_failed_without_partial_claims(client, manager):
    manager.search_target = failing_search
    job_id = post_job(client, small_request())['jobId']
    body = wait_terminal(client, job_id)
    assert body['state'] == 'failed' and body['result'] is None
    assert body['error'] == dict(code='SEARCH_FAILED', message=body['error']['message'])
    assert 'teacher' not in body['error']['message'].lower() and 'boom' not in body['error']['message']


def silent_exit(conn, request_json):
    import os
    os._exit(3)


def test_lost_search_process_reports_failed(client, manager):
    manager.search_target = silent_exit
    body = wait_terminal(client, post_job(client, small_request())['jobId'])
    assert body['state'] == 'failed' and body['error']['code'] == 'SEARCH_PROCESS_LOST' and body['result'] is None


def test_terminal_jobs_are_bounded_in_count_and_age(client, manager):
    manager.max_terminal_jobs = 2
    ids = []
    for _ in range(4):
        ids.append(post_job(client, small_request(budget=1.0, sections=1))['jobId'])
        wait_terminal(client, ids[-1])
    assert [client.get(f'/v1/solve-jobs/{i}').status_code for i in ids] == [404, 404, 200, 200]
    base = time.monotonic()
    manager.clock = lambda: base + 15 * 60 + 1
    assert [client.get(f'/v1/solve-jobs/{i}').status_code for i in ids] == [404, 404, 404, 404]


def test_invalid_budget_is_rejected(client):
    body = small_request().model_dump()
    body['maxTimeSeconds'] = 121
    assert client.post('/v1/solve-jobs', json=body).status_code == 422
