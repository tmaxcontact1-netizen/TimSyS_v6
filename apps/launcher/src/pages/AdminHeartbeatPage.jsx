import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/base';

function AdminHeartbeatPage({ app }) {
  const navigate = useNavigate();
  const [section, setSection] = useState('home');
  const [rooms, setRooms] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState({ room_number: '', capacity: 1 });
  const [item, setItem] = useState({ item_number: '', item_name: '', quantity: 1 });

  const load = async () => {
    try {
      const [places, stuff] = await Promise.all([
        apiClient.get('/rooms', { params: { app_id: app.appId } }),
        apiClient.get('/inventory', { params: { app_id: app.appId } })
      ]);
      setRooms(places.data.rooms || []); setItems(stuff.data.items || []); setError(null);
    } catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
  };
  useEffect(() => { load(); }, [app.appId]);

  const addRoom = async event => {
    event.preventDefault();
    try { await apiClient.post('/rooms', { ...room, capacity: Number(room.capacity), app_id: app.appId }); setRoom({ room_number: '', capacity: 1 }); await load(); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
  };
  const addItem = async event => {
    event.preventDefault();
    try { await apiClient.post('/inventory', { ...item, quantity: Number(item.quantity), app_id: app.appId }); setItem({ item_number: '', item_name: '', quantity: 1 }); await load(); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
  };

  return <div className="min-h-screen bg-timsys-dark text-white">
    <nav className="border-b border-gray-800 bg-gray-900/80"><div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
      <div className="flex gap-4 items-center"><button onClick={() => section === 'home' ? navigate('/') : setSection('home')} className="text-gray-400 hover:text-white">← Back</button><h1 className="text-2xl font-bold text-timsys-primary">{app.displayName}</h1></div>
      <button onClick={() => navigate('/')} className="text-gray-300">Return to launcher</button>
    </div></nav>
    <main className="max-w-6xl mx-auto p-6">
      {error && <div className="mb-5 border border-red-600 bg-red-950/50 rounded p-3 text-red-200">{error}</div>}
      {section === 'home' ? <>
        <h2 className="text-2xl font-semibold">Application home</h2>
        <p className="text-gray-400 mt-2">The application heartbeat is active. Places and Stuff are operational; specialised workflows have not been configured.</p>
        <div className="grid md:grid-cols-2 gap-5 mt-8">
          <button onClick={() => setSection('places')} className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-left hover:border-timsys-primary"><h3 className="text-xl font-semibold">Places</h3><p className="text-gray-400 mt-2">Room Manifest</p><p className="text-sm text-gray-500 mt-5">{rooms.length} records</p></button>
          <button onClick={() => setSection('stuff')} className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-left hover:border-timsys-primary"><h3 className="text-xl font-semibold">Stuff</h3><p className="text-gray-400 mt-2">Inventory</p><p className="text-sm text-gray-500 mt-5">{items.length} records</p></button>
        </div>
      </> : section === 'places' ? <>
        <h2 className="text-2xl font-semibold mb-5">Places</h2>
        <form onSubmit={addRoom} className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3 mb-6"><input required value={room.room_number} onChange={e => setRoom({ ...room, room_number: e.target.value })} placeholder="Place or room identifier" className="bg-gray-900 border border-gray-700 rounded p-3"/><input required min="1" type="number" value={room.capacity} onChange={e => setRoom({ ...room, capacity: e.target.value })} className="bg-gray-900 border border-gray-700 rounded p-3"/><button className="bg-timsys-primary rounded px-5">Add place</button></form>
        <div className="rounded-xl border border-gray-800 overflow-hidden"><table className="w-full"><thead className="bg-gray-900 text-gray-400"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Identifier</th><th className="p-3 text-left">Capacity</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{rooms.map((entry, index) => <tr key={entry.id} className="border-t border-gray-800"><td className="p-3">{index + 1}</td><td className="p-3">{entry.room_number}</td><td className="p-3">{entry.capacity}</td><td className="p-3">{entry.status}</td></tr>)}</tbody></table>{!rooms.length && <p className="p-6 text-gray-500">No places have been added to this application.</p>}</div>
      </> : <>
        <h2 className="text-2xl font-semibold mb-5">Stuff</h2>
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-[160px_1fr_120px_auto] gap-3 mb-6"><input required value={item.item_number} onChange={e => setItem({ ...item, item_number: e.target.value })} placeholder="Item number" className="bg-gray-900 border border-gray-700 rounded p-3"/><input required value={item.item_name} onChange={e => setItem({ ...item, item_name: e.target.value })} placeholder="Item name" className="bg-gray-900 border border-gray-700 rounded p-3"/><input required min="0" type="number" value={item.quantity} onChange={e => setItem({ ...item, quantity: e.target.value })} className="bg-gray-900 border border-gray-700 rounded p-3"/><button className="bg-timsys-primary rounded px-5">Add item</button></form>
        <div className="rounded-xl border border-gray-800 overflow-hidden"><table className="w-full"><thead className="bg-gray-900 text-gray-400"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Item</th><th className="p-3 text-left">Quantity</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{items.map((entry, index) => <tr key={entry.id} className="border-t border-gray-800"><td className="p-3">{index + 1}</td><td className="p-3">{entry.item_name}</td><td className="p-3">{entry.quantity}</td><td className="p-3">{entry.status}</td></tr>)}</tbody></table>{!items.length && <p className="p-6 text-gray-500">No inventory has been added to this application.</p>}</div>
      </>}
    </main>
  </div>;
}

export default AdminHeartbeatPage;
