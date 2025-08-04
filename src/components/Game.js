// src/components/Game.js
import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import CityView from './CityView';
import MapView from './MapView';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useWorldClock } from '../hooks/useWorldClock';
import { useMovementProcessor } from '../hooks/useMovementProcessor';

const Game = ({ onBackToWorlds }) => {
    const { worldId, gameState, worldState } = useGame();
    const [view, setView] = useState('city'); // 'city' or 'map'
    const [isChatOpen, setIsChatOpen] = useState(false);

    // #comment Custom hooks to handle complex game logic
    useWorldClock(worldId, worldState);
    useMovementProcessor(worldId);

    if (!gameState) {
        return <LoadingScreen message="Loading Game..." />;
    }

    const showMap = () => setView('map');
    const showCity = () => setView('city');

    return (
        <div className="w-full h-screen bg-gray-900 text-white">
            {view === 'city' && <CityView showMap={showMap} worldId={worldId} />}
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
