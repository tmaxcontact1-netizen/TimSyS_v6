import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import TileGrid from '../components/Dashboard/TileGrid';
import IntelligencePanel from '../components/Dashboard/IntelligencePanel';
import useSettingsStore from '../store/settingsStore';
import useAuthStore from '../store/authStore';
import { getSSEClient } from '../api/stream';

function PrincipalEdPage() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tileLayout, intelligencePanelOpen, setTileLayout, toggleIntelligencePanel } = useSettingsStore();
  
  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Setup SSE listener
    const sse = getSSEClient();
    
    const handleNotification = (data) => {
      if (data.type === 'alert') {
        setAlerts(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 9)]);
      } else if (data.type === 'recommendation') {
        setRecommendations(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 4)]);
      }
    };

    sse.subscribe('notification.created', handleNotification);
    sse.subscribe('auto_rules.analyzed', handleNotification);
    sse.subscribe('snapshot.completed', handleNotification);

    return () => {
      sse.unsubscribe('notification.created', handleNotification);
      sse.unsubscribe('auto_rules.analyzed', handleNotification);
      sse.unsubscribe('snapshot.completed', handleNotification);
    };
  }, [user, navigate]);

  const handleBack = () => {
    navigate('/');
  };

  return (
    <MainLayout
      sidebar={
        <div className="p-4">
          <button
            onClick={handleBack}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg mb-4"
          >
            ← Back to Launcher
          </button>
          <nav className="space-y-2">
            <a href="#" className="block px-4 py-2 bg-timsys-primary text-white rounded-lg">Dashboard</a>
            <a href="#" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">Students</a>
            <a href="#" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">Staff</a>
            <a href="#" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">Rooms</a>
            <a href="#" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">Inventory</a>
          </nav>
        </div>
      }
      header={
        <div className="flex justify-between items-center p-4">
          <h1 className="text-xl font-bold text-white">Principal'Ed</h1>
          <button
            onClick={toggleIntelligencePanel}
            className="bg-timsys-accent hover:bg-timsys-primary text-white px-4 py-2 rounded-lg"
          >
            {intelligencePanelOpen ? 'Hide Feed' : 'Show Feed'}
          </button>
        </div>
      }
      intelligencePanel={intelligencePanelOpen && (
        <IntelligencePanel alerts={alerts} recommendations={recommendations} />
      )}
    >
      <div className="p-6">
        <TileGrid>
          {/* Placeholder tiles - will be populated from tileLayout store */}
          <Tile title="Quick Stats">Coming soon</Tile>
          <Tile title="Recent Activity">Coming soon</Tile>
          <Tile title="Pending Tasks">Coming soon</Tile>
          <Tile title="System Health">Coming soon</Tile>
        </TileGrid>
      </div>
    </MainLayout>
  );
}

export default PrincipalEdPage;