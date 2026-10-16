#!/usr/bin/env python3
"""Validate installed catalog and runtime settings without inference or SUM access."""
import argparse
import hashlib
import json
from pathlib import Path
import select
import subprocess
import tempfile
import time
import tomllib


ROOT = Path(__file__).resolve().parents[4]
EXPECTED = {
    'sum-explorer': ('gpt-6-luna', 'low'),
    'sum-implementer': ('gpt-6-luna', 'high'),
    'sum-executor': ('gpt-6-luna', 'high'),
    'sum-verifier': ('gpt-6-luna', 'low'),
    'sum-planner': ('gpt-6.1-sol', 'high'),
    'sum-reviewer': ('gpt-6.1-sol', 'high'),
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def contains_settings(actual, expected):
    """Codex may add default fields while serializing the effective config."""
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(
            k in actual and contains_settings(actual[k], v) for k, v in expected.items())
    return actual == expected


def validate():
    report = {'cli': subprocess.check_output(['codex', '--version'], text=True).strip(),
              'scope': 'Catalog, effective config and ephemeral threads; no inference, no SUM access',
              'roles': []}
    with tempfile.TemporaryFile(mode='w+') as stderr:
        process = subprocess.Popen(['codex', 'app-server', '--stdio', '--strict-config'],
                                   cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=stderr, bufsize=0)
        next_id = 0

        def request(method, params):
            nonlocal next_id
            next_id += 1
            process.stdin.write((json.dumps({'id': next_id, 'method': method, 'params': params}) + '\n').encode())
            process.stdin.flush()
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if not select.select([process.stdout], [], [], 1)[0]:
                    continue
                line = process.stdout.readline()
                require(bool(line), 'App-server closed unexpectedly')
                response = json.loads(line)
                if response.get('id') == next_id:
                    # Do not print whole config, stderr or MCP authentication headers.
                    require('error' not in response, f'{method} failed: {response.get("error", {}).get("code")}')
                    return response['result']
            raise TimeoutError(method)

        try:
            request('initialize', {'clientInfo': {'name': 'sum-routing-validation', 'version': '1'},
                                   'capabilities': {'experimentalApi': True}})
            process.stdin.write(b'{"method":"initialized"}\n')
            process.stdin.flush()
            models = {}
            cursor = None
            while True:
                page = request('model/list', {'limit': 100, 'cursor': cursor})
                models.update({m['model']: m for m in page['data']})
                cursor = page.get('nextCursor')
                if not cursor:
                    break
            for model, effort in set(EXPECTED.values()):
                require(model in models, f'Model unavailable: {model}')
                supported = {x['reasoningEffort'] for x in models[model]['supportedReasoningEfforts']}
                require(effort in supported, f'Unsupported effort: {model}/{effort}')
            report['available'] = {m: [e['reasoningEffort'] for e in models[m]['supportedReasoningEfforts']]
                                   for m in sorted({p[0] for p in EXPECTED.values()})}
            config = request('config/read', {'cwd': str(ROOT), 'includeLayers': True})['config']
            require(config['model'] == 'gpt-6-luna' and config['model_reasoning_effort'] == 'medium',
                    'Project defaults are not effective (trust or CLI override)')
            require(config['agents']['max_concurrent_threads_per_session'] == 2, 'Concurrency limit not applied')
            require(config['agents']['enabled'] is True, 'Agents disabled')
            require(config['agents']['default_subagent_model'] == 'gpt-6-luna', 'Subagent model default mismatch')
            require(config['agents']['default_subagent_reasoning_effort'] == 'medium', 'Subagent effort default mismatch')
            report['effective'] = {k: config[k] for k in ['model', 'model_reasoning_effort', 'agents']}
            # Compare inherited objects internally without disclosing secrets.
            home = Path.home() / '.codex/config.toml'
            user_config = tomllib.loads(home.read_text())
            for key in ['mcp_servers', 'hooks', 'skills', 'plugins']:
                if key in user_config:
                    require(contains_settings(config.get(key), user_config[key]), f'Inherited {key} changed')
            report['inherited_user_settings'] = 'MCP/hooks/skills/plugins preserved when present'
            parent = request('thread/start', {'cwd': str(ROOT), 'ephemeral': True, 'environments': []})
            require((parent['model'], parent['reasoningEffort']) == ('gpt-6-luna', 'medium'),
                    'Parent runtime default mismatch')
            report['parent_runtime'] = {k: parent[k] for k in ['model', 'reasoningEffort']}
            request('thread/unsubscribe', {'threadId': parent['thread']['id']})
            for name, pair in EXPECTED.items():
                path = ROOT / '.codex/agents' / f'{name}.toml'
                role = tomllib.loads(path.read_text())
                require(role['name'] == name, f'Role name mismatch: {name}')
                require(bool(role['description']) and bool(role['developer_instructions']), f'Incomplete role: {name}')
                require((role['model'], role['model_reasoning_effort']) == pair, f'Role policy mismatch: {name}')
                # This harness's fallback passes the TOML's actual model/effort to runtime.
                # This does not claim a native agent_type dispatch or an inference.
                thread = request('thread/start', {
                    'cwd': str(ROOT), 'ephemeral': True, 'environments': [],
                    'allowProviderModelFallback': False,
                    'config': {'model': role['model'], 'model_reasoning_effort': role['model_reasoning_effort']},
                    'developerInstructions': role['developer_instructions'],
                })
                require((thread['model'], thread['reasoningEffort']) == pair, f'Runtime mismatch: {name}')
                report['roles'].append({'name': name, 'file': str(path.relative_to(ROOT)),
                                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                        'model': thread['model'], 'reasoningEffort': thread['reasoningEffort'],
                                        'validation': 'ephemeral runtime with explicit TOML values'})
                request('thread/unsubscribe', {'threadId': thread['thread']['id']})
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Optional sanitized report file')
    args = parser.parse_args()
    result = validate()
    payload = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(payload)
    print(payload)
