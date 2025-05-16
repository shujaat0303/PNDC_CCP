import React, { useState, useEffect } from 'react';
import { post, get } from './api';
import './App.css';

export default function App() {
  const [view, setView]     = useState('login'); // 'login' | 'jobs'
  const [provId, setProvId]   = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [jobs, setJobs]     = useState([]);

  const login = async () => {
    await post('/login', { id: +provId, user_type: 'provider' });
    setLoggedIn(true);
    setView('jobs');
  };

  const logout = () => {
    setLoggedIn(false);
    setProvId('');
    setJobs([]);
    setView('login');
  };

  useEffect(() => {
    if (view !== 'jobs') return;
    const iv = setInterval(async () => {
      setJobs(await get(`/providers/${provId}/requests`));
    }, 5000);
    return () => clearInterval(iv);
  }, [view, provId]);

  const bid = async (rid) => {
    const price = prompt(`Your bid for request ${rid}`);
    await post(`/providers/${provId}/requests/${rid}/bids`, { price: +price });
  };

  return (
    <div className="app-container">
      <nav>
        {['login','jobs'].map(tab => (
          <button
            key={tab}
            className={view===tab ? 'active' : ''}
            disabled={!loggedIn && tab !== 'login'}
            onClick={()=>setView(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {loggedIn && (
        <button className="submit" style={{float:'right'}} onClick={logout}>
          Logout
        </button>
      )}

      {view === 'login' && (
        <section>
          <h2>Mobile Bid App Login</h2>
          <input
            value={provId}
            onChange={e => setProvId(e.target.value)}
            placeholder="Provider ID"
          />
          <button className="submit" onClick={login} disabled={!provId}>
            Login
          </button>
        </section>
      )}

      {view === 'jobs' && (
        <section>
          <h2>Available Jobs</h2>
          {jobs.length === 0 && <p>No jobs available.</p>}
          {jobs.map(j => (
            <div key={j.request_id}>
              Job #{j.request_id} (Client {j.client_id})
              <button style={{marginLeft:'1rem'}} onClick={()=>bid(j.request_id)}>
                Place Bid
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}