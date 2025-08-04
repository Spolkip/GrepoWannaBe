// src/components/Game.js
import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import CityView from './CityView';
import MapView from './MapView';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useMovementProcessor } from '../hooks/useMovementProcessor';

const Game = ({ onBackToWorlds }) => {
    const { activeCityId, setActiveCityId, worldId, loading } = useGame();
    const [view, setView] = useState('city'); // 'city' or 'map'
    const [isChatOpen, setIsChatOpen] = useState(false);

    // #comment This hook runs in the background to process completed movements.
    useMovementProcessor(worldId);

    const showMap = () => setView('map');
    
    /**
     * #comment Sets the active city and switches to the city view.
     * @param {string} cityId - The ID of the city to switch to.
     */
    const showCity = (cityId) => {
        if (cityId) {
            setActiveCityId(cityId);
        }
        setView('city');
    };

    if (loading) {
        return <LoadingScreen message="Loading Game..." />;
    }

    return (
        <div className="w-full h-screen bg-gray-900 text-white">
            {view === 'city' && <CityView showMap={showMap} worldId={worldId} cityId={activeCityId} />}
            {view === 'map' && <MapView showCity={showCity} onBackToWorlds={onBackToWorlds} />}
            
            <div className="chat-container">
                <button onClick={() => setIsChatOpen(prev => !prev)} className="chat-toggle-button">
                    💬
                </button>
                <Chat 
                    isVisible={isChatOpen} 
                    onClose={() => setIsChatOpen(false)} 
                />
            </div>
        </div>
    );
};

export default Game;
