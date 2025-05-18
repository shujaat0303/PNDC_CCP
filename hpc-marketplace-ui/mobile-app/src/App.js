import React, { useState, useEffect } from 'react';
import { post, get } from './api';
import './App.css';

export default function App() {
  const [view, setView]           = useState('login'); // 'login' | 'jobs'
  const [provId, setProvId]         = useState('');
  const [loggedIn, setLoggedIn]     = useState(false);
  const [jobs, setJobs]           = useState([]);
  const [errorMsg, setErrorMsg]     = useState('');
  const [statusInfo, setStatusInfo]   = useState(null);

  // ---- Login / Logout ----
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

  // ---- Poll for jobs & status every 5s ----
  useEffect(() => {
    if (view !== 'jobs') return;

    const fetchJobs = async () => {
      let info;
      try {
        // 1) Fetch provider status
        info = await get(`/providers/${provId}/status`);
        console.log('DEBUGGING-- Provider status:', info);
        setStatusInfo(info);
      } catch {
        setErrorMsg('Error fetching provider status.');
        setJobs([]);
        return;
      }

      // 2) If available → fetch open jobs
      if (info.available) {
        try {
          const openJobs = await get(`/providers/${provId}/requests`);
          console.log('DEBUGGING-- Open jobs:', openJobs);
          setJobs(openJobs);
          setErrorMsg(''); // clear any previous
        } catch {
          setErrorMsg('Error fetching jobs.');
          setJobs([]);
        }
      } else if (info.current_job) {
        // 3) If busy and has a current_job → show that instead of “unavailable”
        setJobs([]);        // clear job list
        setErrorMsg('');    // clear “unavailable” text
      } else {
        // 4) Busy with no current_job (edge case)
        setJobs([]);
        setErrorMsg('Provider unavailable.');
      }
    };

    fetchJobs();
    const iv = setInterval(fetchJobs, 5000);
    return () => clearInterval(iv);
  }, [view, provId]);

  // ---- Place a bid ----
  const bid = async (rid) => {
    try {
      const price = +prompt(`Your bid for Job #${rid}`);
      if (isNaN(price)) return;
      await post(`/providers/${provId}/requests/${rid}/bids`, { price });
      setErrorMsg('Bid placed successfully.');
    } catch {
      // On error, refresh status and show message accordingly
      try {
        const info = await get(`/providers/${provId}/status`);
        setStatusInfo(info);
        if (!info.available && info.current_job) {
          setErrorMsg(
            `Cannot bid: busy with Job #${info.current_job.request_id} for Client ${info.current_job.client_id}.`
          );
        } else {
          setErrorMsg('Cannot bid: provider unavailable.');
        }
      } catch {
        setErrorMsg('Error fetching provider status.');
      }
    }
  };

  return (
    <div className="app-container">
      <div className="header">HPC Bidding</div>

      {errorMsg && (
        <div className="error-banner">{errorMsg}</div>
      )}

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
            {/* If busy and has a current_job, render that job info */}
            {statusInfo && !statusInfo.available && statusInfo.current_job && (
              <div className="card">
                <h3>Current Job</h3>
                <p><strong>Job #{statusInfo.current_job.request_id}</strong></p>
                <p>Client: {statusInfo.current_job.client_id}</p>
                <p>Cores: {statusInfo.current_job.cores}</p>
                <p>Clock Speed: {statusInfo.current_job.clock_speed} GHz</p>
                <p>Memory: {statusInfo.current_job.memory} MB</p>
              </div>
            )}

            {/* If available, show open jobs list */}
            {statusInfo && statusInfo.available && (
              <>
                {jobs.length === 0 && !errorMsg && (
                  <p style={{ textAlign: 'center', color: '#666' }}>
                    No jobs available.
                  </p>
                )}
                {jobs.map(j => (
                  <div key={j.request_id} className="card">
                    <h3>Job #{j.request_id}</h3>
                    <p>Client: {j.client_id}</p>
                    <p>{j.cores} cores @ {j.clock_speed} GHz</p>
                    <p>{j.memory} MB RAM</p>
                    <button
                      className="button"
                      onClick={() => bid(j.request_id)}
                      disabled={!statusInfo.available}
                    >
                      Place Bid
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* If busy but no current_job (rare), show unavailable */}
            {statusInfo && !statusInfo.available && !statusInfo.current_job && (
              <p style={{ textAlign: 'center', color: '#666' }}>
                Provider unavailable.
              </p>
            )}
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