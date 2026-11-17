import pytest


@pytest.fixture(autouse=True)
def _isolated_shared_dry_runs():
    """Shared dry-run results must not leak between tests (some patch the solver)."""
    from advisor_agent import clear_shared_dry_runs
    clear_shared_dry_runs()
    yield
    clear_shared_dry_runs()
