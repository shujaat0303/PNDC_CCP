# HPC Marketplace Simulation

This repository contains everything needed to simulate a simple high‑performance compute (HPC) marketplace:

- **Flask REST API** (server) on port **8000**  
- **Job Executor** microservice (polls the API, compiles+runs submitted C code with OpenMP)  
- **React Client App** (clients submit code & specs, view & accept bids) on port **3000**  
- **React Provider App** (providers set their PC specs) on port **3001**  
- **React Mobile App** (providers place bids) on port **3002**

---

## Prerequisites

- **Python 3.8+**, with `pip`  
- **Node.js 14+**, with `npm`  
- **GCC** (for compiling C jobs)  
- **Git** (to clone the repo)

---

## 1. Clone the Repository

```bash
git clone https://github.com/your‑org/hpc‑marketplace.git
cd hpc‑marketplace
```


## 2. Backend Setup (Flask + SQLite)
##### 2.1 Create & activate a virtualenv
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
```

##### 2.2 Install Python dependencies
```bash
pip install -r requirements.txt
```

##### 2.3 Initialize the database
Make sure the instance/ directory exists:

```bash
mkdir -p instance
```

Run the migrations:

```bash
export FLASK_APP=server.py
flask db init
flask db migrate -m "Initial schema"
flask db upgrade
```

2.4 Start the API server

```bash
python server.py
```

The API will listen on http://localhost:8000.
## 3. Job Executor Setup

In a separate shell (still inside server/.venv):

```bash
cd server
pip install requests
python job_executor.py
```

This process will poll the API every 10 s for scheduled jobs, compile/run them with gcc -fopenmp, and post results back.
## 4. Front‑End Setup

Each front‑end is a Create‑React‑App project in its own folder. You can run them concurrently.
##### 4.1 Shared API config

In each of client-app, provider-app, and mobile-app, create a file:
### from the root
##### 4.2 Client App (port 3000)

cd client-app
npm install
npm start

Open http://localhost:3000.
##### 4.3 Provider App (port 3001)

cd provider-app
npm install
npm start -- --port 3001

Open http://localhost:3001.
##### 4.4 Mobile App (port 3002)

cd mobile-app
npm install
npm start -- --port 3002

Open http://localhost:3002 (or point your mobile browser to it).
## 5. End‑to‑End Simulation

    Provider (port 3001):

        Login with an integer ID, set your CPU/cores/RAM.

    Mobile (port 3002):

        Login with the same provider ID, view available client jobs, place bids.

    Client (port 3000):

        Login with a new client ID, submit C code + specs.

        Watch for incoming bids, accept one when it arrives.

    Executor (server/job_executor):

        Detects the scheduled job, compiles & runs it in parallel, posts results.

    Client:

        Monitor the Status tab to see when the job completes and view output.

    Provider:

        Once your job is done, the “Jobs” list will re‑enable so you can bid on new work.

## 6. Cleanup

To stop the simulation, simply Ctrl+C each process:

    Flask server

    job_executor.py

    Each React app

You can destroy and recreate the SQLite database by removing instance/marketplace.sqlite and rerunning the migrations.