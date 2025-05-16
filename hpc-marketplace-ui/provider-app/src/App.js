import React, { useState } from 'react';
import { post, get } from './api';
import './App.css';

export default function App() {
  const [provId, setProvId]     = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [specs, setSpecs]       = useState({ cores: 8, clock_speed: 3.0, memory: 8192 });
  const [message, setMessage]   = useState('');

  const loginAndUpload = async () => {
    await post('/login',      { id:+provId, user_type:'provider' });
    await post(`/providers/${provId}/specs`, specs);
    setLoggedIn(true);
    setMessage('Specs saved.');
  };

  const logout = async () => {
    await post(`/providers/${provId}/logout`);
    setLoggedIn(false);
    setProvId('');
    setMessage('Logged out.');
  };

  if (!loggedIn) {
    return (
      <div className="app-container">
        <h2>Provider Login & Specs</h2>
        <input
          value={provId}
          onChange={e => setProvId(e.target.value)}
          placeholder="Provider ID"
        />
        <button className="submit" onClick={loginAndUpload}>
          Login & Upload Specs
        </button>
        {message && <p>{message}</p>}
      </div>
    );
  }

  return (
    <div className="app-container">
      <h2>Update PC Specifications</h2>

      <label>Cores:</label>
      <input
        type="number"
        value={specs.cores}
        onChange={e => setSpecs(s=>({...s, cores:+e.target.value}))}
      />

      <label>Clock Speed (GHz):</label>
      <input
        type="number" step="0.1"
        value={specs.clock_speed}
        onChange={e => setSpecs(s=>({...s, clock_speed:+e.target.value}))}
      />

      <label>Memory (MB):</label>
      <input
        type="number"
        value={specs.memory}
        onChange={e => setSpecs(s=>({...s, memory:+e.target.value}))}
      />

      <button
        className="submit"
        onClick={async () => {
          await post(`/providers/${provId}/specs`, specs);
          setMessage(`Specs updated at ${new Date().toLocaleTimeString()}`);
        }}
      >
        Save Specs
      </button>

      <button
        className="submit"
        style={{marginLeft:'1rem', background:'#dc3545'}}
        onClick={logout}
      >
        Logout
      </button>

      {message && <p style={{marginTop:'1rem'}}>{message}</p>}
    </div>
  );
}