"""Exact section/teacher capacity relaxation, independent of timetable placement.

Eligibility is supplied by the timetable's existing predicate. No regulation or
implicit cap is resolved here. A feasible witness alone is never a certificate.
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


def _model(req, eligible, sections, minutes, caps, exceptions=False):
    model = cp_model.CpModel()
    options = {}
    by_teacher = defaultdict(list)
    for section in sections:
        choices = []
        for teacher in sorted(eligible.get(section.courseId, []), key=lambda t: t.id):
            var = model.new_bool_var(f'capacity_{section.id}_{teacher.id}')
            options[section.id, teacher.id] = var
            by_teacher[teacher.id].append((section, var))
            choices.append(var)
        model.add(sum(choices) <= 1)
    excesses, enabled = {}, {}
    for teacher in sorted(req.teachers, key=lambda t: t.id):
        items = by_teacher[teacher.id]
        load = sum(minutes[s.id] * v for s, v in items)
        cap = caps[teacher.id]
        model.add(load <= cap)
        for limit in teacher.sectionLimits or []:
            model.add(sum(v for s, v in items if s.courseId == limit.courseId) <= limit.maxSections)
        if exceptions and cap > teacher.maxWeeklyMinutes:
            extra = model.new_int_var(0, cap - teacher.maxWeeklyMinutes, f'extra_{teacher.id}')
            used = model.new_bool_var(f'exception_{teacher.id}')
            model.add_max_equality(extra, [0, load - teacher.maxWeeklyMinutes])
            model.add(extra <= (cap - teacher.maxWeeklyMinutes) * used)
            model.add(extra >= used)
            excesses[teacher.id], enabled[teacher.id] = extra, used
    return model, options, excesses, enabled


def _analyze_capacity(req, eligible, deadline):
    minutes = Counter()
    for item in req.requirements:
        minutes[item.sectionId] += item.durationMinutes
    sections = sorted((s for s in req.sections if minutes[s.id] > 0), key=lambda s: s.id)
    caps = {t.id: t.maxWeeklyMinutes for t in req.teachers}
    model, options, _, _ = _model(req, eligible, sections, minutes, caps)
    solver, status = _solve(model, sum(options.values()), deadline)
    proven = status == cp_model.OPTIMAL
    covered = Counter()
    if status in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        for section in sections:
            covered[section.courseId] += sum(solver.value(options[section.id, t.id]) for t in eligible.get(section.courseId, []))
    required = Counter(s.courseId for s in sections)
    required_minutes = Counter()
    for section in sections:
        required_minutes[section.courseId] += minutes[section.id]
    certificate = CapacityCertificate(proven=proven, requiredSectionsTotal=len(sections),
        coverableSectionsTotal=sum(covered.values()), courses=[CapacityCourse(courseId=cid,
            requiredSections=count, coverableSections=covered[cid], requiredMinutes=required_minutes[cid])
            for cid, count in sorted(required.items()) if covered[cid] < count])
    if not proven or sum(covered.values()) == len(sections):
        return certificate, [], proven

    relaxed_caps = {t.id: t.exceptionMaxWeeklyMinutes or t.maxWeeklyMinutes for t in req.teachers}
    extras = {}
    if relaxed_caps != caps:
        model, options, extras, enabled = _model(req, eligible, sections, minutes, relaxed_caps, exceptions=True)
        # Fix achieved objective values, preserving all global reassignment choices.
        solver, status = _solve(model, sum(options.values()), deadline)
        if status != cp_model.OPTIMAL:
            return certificate, [], False
        relaxed_total = int(solver.value(sum(options.values())))
        model.add(sum(options.values()) == relaxed_total)
        for objective in [sum(enabled.values()), sum(extras.values())]:
            solver, status = _solve(model, objective, deadline, maximize=False)
            if status != cp_model.OPTIMAL:
                return certificate, [], False
            model.add(objective == int(solver.value(objective)))

    selected = {sid: tid for (sid, tid), var in options.items() if solver.value(var)}
    selected_by_teacher = defaultdict(list)
    for section in sections:
        if section.id in selected:
            selected_by_teacher[selected[section.id]].append(section)
    used_extras = {tid: solver.value(var) for tid, var in extras.items() if solver.value(var)}
    decisions = []
    previous_total = certificate.coverableSectionsTotal
    # Attribute unlocked sections as marginal gains when enabling the minimal
    # concessions in teacher-ID order. Re-solve globally: no assignments freeze.
    for tid, extra in sorted(used_extras.items()):
        caps[tid] += extra
        marginal_model, marginal_options, _, _ = _model(req, eligible, sections, minutes, caps)
        marginal_solver, marginal_status = _solve(marginal_model, sum(marginal_options.values()), deadline)
        if marginal_status != cp_model.OPTIMAL:
            return certificate, [], False
        total = int(marginal_solver.value(sum(marginal_options.values())))
        teacher = next(t for t in req.teachers if t.id == tid)
        decisions.append(CapacityDecision(id=f'teacher-load-exception:{tid}', kind='teacher-load-exception',
            teacherId=tid, courseIds=sorted({s.courseId for s in selected_by_teacher[tid]}),
            exceptionKind=teacher.exceptionKind, additionalMinutes=extra, sectionsUnlocked=total - previous_total))
        previous_total = total
    missing = defaultdict(list)
    for section in sections:
        if section.id not in selected:
            missing[section.courseId].append(section)
    for cid, items in sorted(missing.items()):
        decisions.append(CapacityDecision(id=f'additional-teacher:{cid}', kind='additional-teacher',
            courseIds=[cid], additionalMinutes=sum(minutes[s.id] for s in items), sectionsUnlocked=len(items)))
    return certificate, decisions, True


def analyze_capacity(req, eligible, deadline, excluded_sections=()):
    certificate, decisions, decisions_proven = _analyze_capacity(req, eligible, deadline)
    upper_bound = certificate.coverableSectionsTotal if certificate.proven else None
    if excluded_sections and certificate.proven:
        # Combine independently proven room/window exclusions with shared load
        # capacity, rather than attributing overlapping deficits twice.
        minutes = Counter()
        for item in req.requirements:
            minutes[item.sectionId] += item.durationMinutes
        sections = sorted((s for s in req.sections if minutes[s.id] > 0 and s.id not in excluded_sections), key=lambda s: s.id)
        model, options, _, _ = _model(req, eligible, sections, minutes,
            {t.id: t.maxWeeklyMinutes for t in req.teachers})
        solver, status = _solve(model, sum(options.values()), deadline)
        upper_bound = int(solver.value(sum(options.values()))) if status == cp_model.OPTIMAL else None
    return certificate, decisions, decisions_proven, upper_bound
