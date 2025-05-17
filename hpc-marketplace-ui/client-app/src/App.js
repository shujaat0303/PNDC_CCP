import React, { useState, useEffect } from 'react';
import { post, get } from './api';
import './App.css';

export default function App() {
  const [view, setView]           = useState('login');      // 'login' | 'submit' | 'bids' | 'status' | 'all_bids'
  const [clientId, setClientId]   = useState('');
  const [loggedIn, setLoggedIn]   = useState(false);

  // all request/bid state:
  const [specs, setSpecs]         = useState({ cores: 4, clock_speed: 2.5, memory: 4096 });
  const [codeText, setCodeText]   = useState('');
  const [reqId, setReqId]         = useState(null);
  const [bids, setBids]           = useState([]);
  const [requests, setRequests]   = useState([]);
  const [allRequests, setAllRequests]     = useState([]);
  const [selectedReq, setSelectedReq]     = useState(null);
  const [selectedBids, setSelectedBids]   = useState([]);

  // Helper to reset all request/bid state
  const clearAllData = () => {
    setSpecs({ cores: 4, clock_speed: 2.5, memory: 4096 });
    setCodeText('');
    setReqId(null);
    setBids([]);
    setRequests([]);
    setAllRequests([]);
    setSelectedReq(null);
    setSelectedBids([]);
  };

  // ---- Auth & Logout ----
  const login = async () => {
    await post('/login', { id: +clientId, user_type: 'client' });
    clearAllData();
    setLoggedIn(true);
    setView('submit');
  };

  const logout = () => {
    clearAllData();
    setLoggedIn(false);
    setClientId('');
    setView('login');
  };

  // If clientId ever changes from outside (e.g. login in another tab),
  // flush everything:
  useEffect(() => {
    if (!loggedIn) {
      clearAllData();
      setView('login');
    }
  }, [clientId]);

  // ---- Submit Request ----
  const submitRequest = async () => {
    const { request_id } = await post(`/clients/${clientId}/requests`, {
      ...specs,
      code_text: codeText,
    });
    clearAllData();
    setReqId(request_id);
    setView('bids');
  };

  // ---- Poll Bids for current req ----
  useEffect(() => {
    if (view !== 'bids' || !reqId) return;
    setBids([]); // start fresh
    const iv = setInterval(async () => {
      const data = await get(`/clients/${clientId}/requests/${reqId}/bids`);
      setBids(data);
    }, 5000);
    return () => clearInterval(iv);
  }, [view, reqId, clientId]);

  // ---- Poll Status/Results ----
  useEffect(() => {
    if (view !== 'status') return;
    setRequests([]); // start fresh
    const iv = setInterval(async () => {
      const data = await get(`/clients/${clientId}/requests`);
      setRequests(data);
    }, 5000);
    return () => clearInterval(iv);
  }, [view, clientId]);

  // ---- Load All Requests for “All Bids” ----
  useEffect(() => {
    if (view !== 'all_bids') return;
    setAllRequests([]);
    get(`/clients/${clientId}/requests`).then(setAllRequests);
  }, [view, clientId]);

  // ---- Load bids for a selected request ----
  const viewBids = async (rid) => {
    setSelectedReq(rid);
    setSelectedBids([]);
    const data = await get(`/clients/${clientId}/requests/${rid}/bids`);
    setSelectedBids(data);
  };

  // ---- Accept a bid ----
  const acceptBid = async (bid, returnView = 'status') => {
    const rid = bid.request_id || reqId;
    await post(`/clients/${clientId}/requests/${rid}/bids/${bid.id}/accept`, {});
    clearAllData();
    setView('status');
  };

  return (
    <div className="app-container">
      <nav>
        {['login','submit','bids','status','all_bids'].map(tab => (
          <button
            key={tab}
            className={view===tab ? 'active' : ''}
            disabled={!loggedIn && tab!=='login'}
            onClick={()=>setView(tab)}
          >
            {tab === 'all_bids' ? 'All Bids' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {loggedIn && (
        <button
          className="submit"
          style={{ float:'right' }}
          onClick={logout}
        >
          Logout
        </button>
      )}

      {view === 'login' && (
        <section>
          <h2>Client Login</h2>
          <input
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="Client ID"
          />
          <button className="submit" onClick={login} disabled={!clientId}>
            Login
          </button>
        </section>
      )}

      {view === 'submit' && (
        <section>
          <h2>Submit Code Request</h2>
          <textarea
            rows={6}
            value={codeText}
            onChange={e => setCodeText(e.target.value)}
            placeholder="Paste your C code here"
          />
          <label>Cores:</label>
          <input
            type="number"
            value={specs.cores}
            onChange={e => setSpecs(s=>({...s,cores:+e.target.value}))}
          />
          <label>GHz:</label>
          <input
            type="number"
            step="0.1"
            value={specs.clock_speed}
            onChange={e => setSpecs(s=>({...s,clock_speed:+e.target.value}))}
          />
          <label>Memory (MB):</label>
          <input
            type="number"
            value={specs.memory}
            onChange={e => setSpecs(s=>({...s,memory:+e.target.value}))}
          />
          <button className="submit" onClick={submitRequest} disabled={!codeText}>
            Submit Request
          </button>
        </section>
      )}

      {view === 'bids' && (
        <section>
          <h2>Bids for Request #{reqId}</h2>
          {bids.length === 0
            ? <p>No bids yet…</p>
            : bids.map(b => (
                <div key={b.id}>
                  Provider {b.provider_id} bids ${b.price.toFixed(2)}
                  {(b.status === 'BIDDING' || true) && ( // server enforces single accept
                    <button
                      style={{ marginLeft:'1rem' }}
                      onClick={()=>acceptBid(b)}
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))
          }
        </section>
      )}

      {view === 'status' && (
        <section>
          <h2>Your Requests</h2>
          {requests.map(r => (
            <div key={r.id}>
              <strong>#{r.id}</strong> (Client {r.client_id}) — {r.status}
              {r.result_output && (
                <pre>{r.result_output}</pre>
              )}
            </div>
          ))}
        </section>
      )}

      {view === 'all_bids' && (
        <section>
          <h2>All Requests & Their Bids</h2>
          {allRequests.length === 0 && <p>No requests found.</p>}
          {allRequests.map(r => (
            <div key={r.id}>
              <strong>Request #{r.id}</strong> (Client {r.client_id}) — {r.status}
              <button onClick={()=>viewBids(r.id)} style={{ marginLeft:'1rem' }}>
                View Bids
              </button>
              {selectedReq === r.id && (
                <div style={{ marginTop:'0.5rem', paddingLeft:'1rem' }}>
                  {selectedBids.length === 0
                    ? <p>No bids yet.</p>
                    : selectedBids.map(b => (
                        <div key={b.id}>
                          Provider {b.provider_id} bids ${b.price.toFixed(2)}
                          {r.status === 'BIDDING' && (
                            <button
                              style={{ marginLeft:'1rem' }}
                              onClick={()=>acceptBid(b,'all_bids')}
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}