// src/components/Game.js
import React from 'react';
import { useGame } from '../contexts/GameContext';
import CityView from './CityView';
import MapView from './MapView';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useGameManager } from '../hooks/useGameManager';

const Game = ({ onBackToWorlds }) => {
    const { activeCityId, setActiveCityId } = useGame();
    const {
        view,
        isChatOpen,
        setIsChatOpen,
        showMap,
        showCity: showCityView, // #comment Rename to avoid conflict with the new showCity function
        isLoading,
        worldId
    } = useGameManager();

    /**
     * #comment Sets the active city and switches to the city view.
     * @param {string} cityId - The ID of the city to switch to.
     */
    const showCity = (cityId) => {
        setActiveCityId(cityId);
        showCityView();
    };

    if (isLoading) {
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
