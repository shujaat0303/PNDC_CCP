import time, os, subprocess, requests
from pathlib import Path

SERVER_URL = 'http://localhost:8000'
POLL_INTERVAL = 10  # seconds

def fetch_pending():
    r = requests.get(f'{SERVER_URL}/execution/pending')
    r.raise_for_status()
    return r.json()

def compile_and_run(request_id, code_text):
    workdir = Path(f'/tmp/job_{request_id}')
    workdir.mkdir(exist_ok=True)
    c_file = workdir / 'job.c'
    exe    = workdir / 'job.out'

    # write code
    c_file.write_text(code_text)

    # compile with OpenMP
    compile = subprocess.run(
        ['gcc', '-fopenmp', str(c_file), '-o', str(exe)],
        capture_output=True,
        text=True
    )
    if compile.returncode != 0:
        return f"COMPILATION ERROR:\n{compile.stderr}"

    # run and capture stdout (timeout 60s)
    run = subprocess.run(
        [str(exe)],
        capture_output=True,
        text=True,
        timeout=60
    )
    if run.returncode != 0:
        return f"RUNTIME ERROR (code {run.returncode}):\n{run.stderr}"

    return run.stdout

def post_result(request_id, provider_id, output):
    payload = {
        'request_id': request_id,
        'provider_id': provider_id,
        'output': output
    }
    r = requests.post(f'{SERVER_URL}/execution/results', json=payload)
    r.raise_for_status()
    return r.json()

def main():
    print("Job‑Executor starting up… polling every", POLL_INTERVAL, "s")
    seen = set()
    while True:
        try:
            jobs = fetch_pending()
            for job in jobs:
                rid = job['request_id']
                pid = job['provider_id']
                if rid in seen:
                    continue
                print(f"  ↳ Executing job {rid} on provider {pid}")
                output = compile_and_run(rid, job['code_text'])
                print(f"    → Posting result ({len(output)} chars)…")
                resp = post_result(rid, pid, output)
                print("    ✔", resp['message'])
                seen.add(rid)
        except Exception as e:
            print("Error:", e)
        time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main()