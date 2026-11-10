"""Exact section/teacher capacity relaxation, independent of timetable placement.

Eligibility is supplied by the timetable's existing predicate. No regulation or
implicit cap is resolved here. A feasible witness alone is never a certificate.

Sections of one course with the same required minutes are interchangeable for
capacity, so the model counts sections per (group, teacher) instead of choosing a
teacher per section. Without that aggregation the symmetric per-section model
could not prove the minimal-concession objectives at catalog scale.
"""
from collections import Counter, defaultdict
import time

from ortools.sat.python import cp_model
from models import CapacityCertificate, CapacityCourse, CapacityDecision


def _solve(model, expression, deadline, maximize=True):
    if maximize:
        model.maximize(expression)
    else:
        model.minimize(expression)
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        return solver, cp_model.UNKNOWN
    solver.parameters.max_time_in_seconds = remaining
    return solver, solver.solve(model)


def _groups(req, excluded_sections=()):
    minutes = Counter()
    for item in req.requirements:
        minutes[item.sectionId] += item.durationMinutes
    groups = Counter()
    for section in req.sections:
        if minutes[section.id] > 0 and section.id not in excluded_sections:
            groups[section.courseId, minutes[section.id]] += 1
    return dict(sorted(groups.items()))


def _model(req, eligible, groups, caps, exceptions=False):
    model = cp_model.CpModel()
    counts = {}
    by_teacher = defaultdict(list)
    for (course_id, minutes), size in groups.items():
        choices = []
        for teacher in sorted(eligible.get(course_id, []), key=lambda t: t.id):
            var = model.new_int_var(0, min(size, caps[teacher.id] // minutes), f'capacity_{course_id}_{minutes}_{teacher.id}')
            counts[course_id, minutes, teacher.id] = var
            by_teacher[teacher.id].append((course_id, minutes, var))
            choices.append(var)
        model.add(sum(choices) <= size)
    excesses, enabled = {}, {}
    for teacher in sorted(req.teachers, key=lambda t: t.id):
        items = by_teacher[teacher.id]
        load = sum(minutes * var for _cid, minutes, var in items)
        cap = caps[teacher.id]
        model.add(load <= cap)
        for limit in teacher.sectionLimits or []:
            model.add(sum(var for cid, _minutes, var in items if cid == limit.courseId) <= limit.maxSections)
        if exceptions and cap > teacher.maxWeeklyMinutes and items:
            # Minimized afterwards, so the lower bounds make `extra` the exact overload.
            extra = model.new_int_var(0, cap - teacher.maxWeeklyMinutes, f'extra_{teacher.id}')
            used = model.new_bool_var(f'exception_{teacher.id}')
            model.add(extra >= load - teacher.maxWeeklyMinutes)
            model.add(extra <= (cap - teacher.maxWeeklyMinutes) * used)
            excesses[teacher.id], enabled[teacher.id] = extra, used
    return model, counts, excesses, enabled


def _analyze_capacity(req, eligible, deadline):
    groups = _groups(req)
    total_sections = sum(groups.values())
    caps = {t.id: t.maxWeeklyMinutes for t in req.teachers}
    model, counts, _, _ = _model(req, eligible, groups, caps)
    solver, status = _solve(model, sum(counts.values()), deadline)
    proven = status == cp_model.OPTIMAL
    covered = Counter()
    if status in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        for (course_id, _minutes, _tid), var in counts.items():
            covered[course_id] += solver.value(var)
    required = Counter()
    required_minutes = Counter()
    for (course_id, minutes), size in groups.items():
        required[course_id] += size
        required_minutes[course_id] += minutes * size
    certificate = CapacityCertificate(proven=proven, requiredSectionsTotal=total_sections,
        coverableSectionsTotal=sum(covered.values()), courses=[CapacityCourse(courseId=cid,
            requiredSections=count, coverableSections=covered[cid], requiredMinutes=required_minutes[cid])
            for cid, count in sorted(required.items()) if covered[cid] < count])
    if not proven or sum(covered.values()) == total_sections:
        return certificate, [], proven

    relaxed_caps = {t.id: t.exceptionMaxWeeklyMinutes or t.maxWeeklyMinutes for t in req.teachers}
    extras = {}
    if relaxed_caps != caps:
        model, counts, extras, enabled = _model(req, eligible, groups, relaxed_caps, exceptions=True)
        # Fix achieved objective values, preserving all global reassignment choices.
        solver, status = _solve(model, sum(counts.values()), deadline)
        if status != cp_model.OPTIMAL:
            return certificate, [], False
        model.add(sum(counts.values()) == int(solver.value(sum(counts.values()))))
        for objective in [sum(enabled.values()), sum(extras.values())]:
            if not extras:
                break
            solver, status = _solve(model, objective, deadline, maximize=False)
            if status != cp_model.OPTIMAL:
                return certificate, [], False
            model.add(objective == int(solver.value(objective)))

    assigned = Counter()
    courses_by_teacher = defaultdict(set)
    for (course_id, minutes, tid), var in counts.items():
        value = solver.value(var)
        if value:
            assigned[course_id, minutes] += value
            courses_by_teacher[tid].add(course_id)
    used_extras = {tid: solver.value(var) for tid, var in extras.items() if solver.value(var)}
    decisions = []
    previous_total = certificate.coverableSectionsTotal
    # Attribute unlocked sections as marginal gains when enabling the minimal
    # concessions in teacher-ID order. Re-solve globally: no assignments freeze.
    for tid, extra in sorted(used_extras.items()):
        caps[tid] += extra
        marginal_model, marginal_counts, _, _ = _model(req, eligible, groups, caps)
        marginal_solver, marginal_status = _solve(marginal_model, sum(marginal_counts.values()), deadline)
        if marginal_status != cp_model.OPTIMAL:
            return certificate, [], False
        total = int(marginal_solver.value(sum(marginal_counts.values())))
        teacher = next(t for t in req.teachers if t.id == tid)
        decisions.append(CapacityDecision(id=f'teacher-load-exception:{tid}', kind='teacher-load-exception',
            teacherId=tid, courseIds=sorted(courses_by_teacher[tid]),
            exceptionKind=teacher.exceptionKind, additionalMinutes=extra, sectionsUnlocked=total - previous_total))
        previous_total = total
    missing_sections = Counter()
    missing_minutes = Counter()
    for (course_id, minutes), size in groups.items():
        missing = size - assigned[course_id, minutes]
        if missing:
            missing_sections[course_id] += missing
            missing_minutes[course_id] += missing * minutes
    for cid in sorted(missing_sections):
        decisions.append(CapacityDecision(id=f'additional-teacher:{cid}', kind='additional-teacher',
            courseIds=[cid], additionalMinutes=missing_minutes[cid], sectionsUnlocked=missing_sections[cid]))
    return certificate, decisions, True


def analyze_capacity(req, eligible, deadline, excluded_sections=()):
    certificate, decisions, decisions_proven = _analyze_capacity(req, eligible, deadline)
    upper_bound = certificate.coverableSectionsTotal if certificate.proven else None
    if excluded_sections and certificate.proven:
        # Combine independently proven room/window exclusions with shared load
        # capacity, rather than attributing overlapping deficits twice.
        model, counts, _, _ = _model(req, eligible, _groups(req, excluded_sections),
            {t.id: t.maxWeeklyMinutes for t in req.teachers})
        solver, status = _solve(model, sum(counts.values()), deadline)
        upper_bound = int(solver.value(sum(counts.values()))) if status == cp_model.OPTIMAL else None
    return certificate, decisions, decisions_proven, upper_bound
