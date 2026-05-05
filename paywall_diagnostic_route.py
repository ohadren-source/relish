# ============================================================================
# PAYWALL DIAGNOSTIC ROUTE
# Drop into your existing Flask app (same file or imported blueprint)
# Matches the pattern of /api/relish/usage-status and /api/relish/get-wisdom.
# ============================================================================
#
# Receives diagnostic reports from the RELISH mobile app whenever the paywall
# succeeds, fails, or is manually inspected. Writes every report to a
# JSON-lines log file so you can grep/tail it from the Railway shell.
#
# Expected JSON body:
# {
#   "kind": "launch" | "offerings_loaded" | "offerings_empty" |
#           "offerings_error" | "purchase_success" | "purchase_error" |
#           "purchase_cancelled" | "restore_error" | "init_error" |
#           "diagnostic_opened" | "diagnostic_sent_by_user",
#   "sessionId": "rlsh-<timestamp>-<rand>",
#   "timestamp": "<ISO8601>",
#   "appVersion": "3.2.0",
#   "payload": { ... full diagnostic snapshot ... }
# }
#
# Usage from Railway shell:
#   tail -f /app/paywall_diagnostics.jsonl
#   grep offerings_empty /app/paywall_diagnostics.jsonl | tail -20
#   grep <sessionId> /app/paywall_diagnostics.jsonl
# ============================================================================

import json
import os
from datetime import datetime, timezone
from flask import request, jsonify

# If you're already inside your Flask app file, just use your existing app object.
# Shown here as a standalone snippet — replace `app` with yours.
# from your_app_module import app

DIAGNOSTIC_LOG_PATH = os.environ.get(
    'RELISH_DIAGNOSTIC_LOG',
    '/app/paywall_diagnostics.jsonl'
)

# Valid event kinds — reject unknown ones so a misbehaving client can't
# poison the log with arbitrary strings.
VALID_KINDS = {
    'launch',
    'offerings_loaded',
    'offerings_empty',
    'offerings_error',
    'purchase_success',
    'purchase_error',
    'purchase_cancelled',
    'restore_error',
    'init_error',
    'diagnostic_opened',
    'diagnostic_sent_by_user',
}


@app.route('/api/relish/paywall-diagnostic', methods=['POST'])
def paywall_diagnostic():
    """
    Accept a diagnostic report from the RELISH mobile app.
    Write it to a JSON-lines log file and echo a brief summary to stdout
    (which Railway captures in its own log aggregator).
    """
    try:
        body = request.get_json(silent=True) or {}

        kind = body.get('kind', 'unknown')
        if kind not in VALID_KINDS:
            return jsonify({'ok': False, 'error': f'invalid kind: {kind}'}), 400

        session_id = body.get('sessionId', 'unknown')
        client_ts = body.get('timestamp', '')
        app_version = body.get('appVersion', 'unknown')
        payload = body.get('payload', {})

        # Server-side timestamp is authoritative — client clocks can lie.
        server_ts = datetime.now(timezone.utc).isoformat()

        record = {
            'server_timestamp': server_ts,
            'client_timestamp': client_ts,
            'kind': kind,
            'session_id': session_id,
            'app_version': app_version,
            'client_ip': request.headers.get('X-Forwarded-For', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', ''),
            'payload': payload,
        }

        # Append-only JSONL. One record per line. Safe to grep.
        try:
            with open(DIAGNOSTIC_LOG_PATH, 'a', encoding='utf-8') as f:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        except Exception as file_err:
            # Don't fail the request if disk write fails — at least stdout has it.
            print(f'[paywall-diagnostic] file write failed: {file_err}')

        # Echo a one-line summary to stdout for Railway log tailing.
        bundle = (payload.get('app') or {}).get('bundleId', '?')
        pkg_count = (payload.get('offerings') or {}).get('availablePackageCount', '?')
        err_msg = ((payload.get('errors') or {}).get('offeringsError') or {}).get('message', '')
        print(
            f'[paywall-diagnostic] {kind} session={session_id} '
            f'v={app_version} bundle={bundle} pkgs={pkg_count} '
            f'err={err_msg[:80] if err_msg else "-"}'
        )

        return jsonify({'ok': True, 'received': kind}), 200

    except Exception as e:
        # Never 500 on a diagnostic endpoint — it would mask the real issue
        # and could get flagged by Apple as a broken endpoint during review.
        print(f'[paywall-diagnostic] handler error: {e}')
        return jsonify({'ok': False, 'error': str(e)}), 200


# ============================================================================
# OPTIONAL: helper endpoints for reading diagnostics from the browser.
# Protect with a simple shared-secret header if you expose these publicly.
# ============================================================================

@app.route('/api/relish/paywall-diagnostic/tail', methods=['GET'])
def paywall_diagnostic_tail():
    """
    Return the last N diagnostic records as JSON. Useful for quick inspection
    without needing Railway shell access.
    Query params:
      n: integer, number of records to return (default 50, max 500)
      kind: optional, filter by event kind
      session: optional, filter by sessionId
    """
    # Simple shared-secret gate. Set RELISH_DIAG_TOKEN on Railway.
    expected_token = os.environ.get('RELISH_DIAG_TOKEN')
    if expected_token:
        provided = request.headers.get('X-Diag-Token', '')
        if provided != expected_token:
            return jsonify({'ok': False, 'error': 'unauthorized'}), 401

    try:
        n = min(int(request.args.get('n', 50)), 500)
    except (TypeError, ValueError):
        n = 50

    filter_kind = request.args.get('kind')
    filter_session = request.args.get('session')

    records = []
    try:
        with open(DIAGNOSTIC_LOG_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        # Walk from the end for efficiency on large files.
        for line in reversed(lines):
            if len(records) >= n:
                break
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if filter_kind and rec.get('kind') != filter_kind:
                continue
            if filter_session and rec.get('session_id') != filter_session:
                continue
            records.append(rec)
        records.reverse()
    except FileNotFoundError:
        return jsonify({'ok': True, 'records': [], 'note': 'no log file yet'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

    return jsonify({'ok': True, 'count': len(records), 'records': records})
