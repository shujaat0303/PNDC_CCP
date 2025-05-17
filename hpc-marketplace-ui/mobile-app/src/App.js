import React, { useState, useEffect } from 'react';
import { post, get } from './api';
import './App.css';

export default function App() {
  const [view, setView]         = useState('login'); // 'login' | 'jobs'
  const [provId, setProvId]       = useState('');
  const [loggedIn, setLoggedIn]   = useState(false);
  const [jobs, setJobs]         = useState([]);
  const [errorMsg, setErrorMsg]   = useState('');
  const [statusInfo, setStatusInfo] = useState(null);

  const login = async () => {
    await post('/login', { id: +provId, user_type: 'provider' });
    setLoggedIn(true);
    setView('jobs');
    setErrorMsg('');
    setStatusInfo(null);
  };

  const logout = () => {
    setLoggedIn(false);
    setProvId('');
    setJobs([]);
    setErrorMsg('');
    setStatusInfo(null);
    setView('login');
  };

  // Poll for jobs
  useEffect(() => {
    if (view !== 'jobs') return;
    const fetchJobs = async () => {
      // 1) Always refresh provider status
      let info;
      try {
        info = await get(`/providers/${provId}/status`);
        setStatusInfo(info);
      } catch {
        setErrorMsg('Error fetching provider status.');
        setJobs([]);
        return;
      }

      // 2) If available, fetch open jobs; otherwise clear jobs
      if (info.available) {
        try {
          const openJobs = await get(`/providers/${provId}/requests`);
          setJobs(openJobs);
          setErrorMsg('');
        } catch {
          setErrorMsg('Error fetching jobs.');
          setJobs([]);
        }
      } else {
        // provider busy
        setJobs([]);
        if (info.current_job) {
          setErrorMsg(
            `Busy with Job #${info.current_job.request_id} for Client ${info.current_job.client_id}.`
          );
        } else {
          setErrorMsg('Provider unavailable.');
        }
      }
    };

    fetchJobs();
    const iv = setInterval(fetchJobs, 5000);
    return () => clearInterval(iv);
  }, [view, provId]);

  const bid = async (rid) => {
    try {
      await post(`/providers/${provId}/requests/${rid}/bids`, {
        price: +prompt(`Your bid for request ${rid}`),
      });
      setErrorMsg('Bid placed ✓');
    } catch {
      const info = await get(`/providers/${provId}/status`);
      setStatusInfo(info);
      if (!info.available && info.current_job) {
        setErrorMsg(
          `Cannot bid: busy with Job #${info.current_job.request_id} for Client ${info.current_job.client_id}.`
        );
      } else {
        setErrorMsg('Cannot bid: provider unavailable.');
      }
    }
  };

  return (
    <div className="app-container">
      <div className="header">HPC Bidding</div>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div className="content">
        {view === 'login' && (
          <div className="card">
            <h3>Provider Login</h3>
            <input
              className="login-input"
              value={provId}
              onChange={e => setProvId(e.target.value)}
              placeholder="Enter your Provider ID"
            />
            <button
              className="button"
              onClick={login}
              disabled={!provId}
            >
              Login
            </button>
          </div>
        )}

        {view === 'jobs' && (
          <>
            {jobs.length === 0 && !errorMsg && (
              <p style={{ textAlign: 'center', color: '#666' }}>
                No jobs available.
              </p>
            )}
            {jobs.map(j => (
              <div key={j.request_id} className="card">
                <h3>Job #{j.request_id}</h3>
                <p>Client {j.client_id}</p>
                <p>{j.cores} cores @ {j.clock_speed}GHz</p>
                <p>{j.memory} MB RAM</p>
                <button
                  className="button"
                  onClick={() => bid(j.request_id)}
                  disabled={statusInfo && !statusInfo.available}
                >
                  Place Bid
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {loggedIn && (
        <div className="bottom-nav">
          <button
            className={view === 'login' ? 'active' : ''}
            onClick={logout}
          >
            Logout
          </button>
          <button
            className={view === 'jobs' ? 'active' : ''}
            onClick={() => setView('jobs')}
          >
            Jobs
          </button>
        </div>
      )}
    </div>
  );
}