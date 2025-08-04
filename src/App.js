import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { GameProvider, useGame } from './contexts/GameContext';
import { AllianceProvider } from './contexts/AllianceContext';
import AuthScreen from './components/AuthScreen';
import Game from './components/Game';
import WorldSelectionScreen from './components/WorldSelectionScreen';
import CityFounding from './components/CityFounding'; // #comment Use CityFounding for new players
import LoadingScreen from './components/shared/LoadingScreen';

// #comment This component now correctly decides whether to show the game or the city founding screen.
const GameController = ({ onBackToWorlds }) => {
    const { playerHasCities, worldState, loading: gameLoading } = useGame();

    if (gameLoading) {
        return <LoadingScreen message="Loading World Data..." />;
    }

    if (!worldState) {
        return (
            <div className="text-white text-center p-10">
                <p>Error: Could not load the selected world.</p>
                <button onClick={onBackToWorlds} className="btn btn-primary mt-4">Back to World Selection</button>
            </div>
        );
    }

    if (playerHasCities) {
        return <Game onBackToWorlds={onBackToWorlds} />;
    }
    
    // #comment If the player has no cities in this world, show the founding screen.
    return <CityFounding onCityFounded={() => { /* Context will handle the view change */ }} />;
};


function App() {
    const [selectedWorldId, setSelectedWorldId] = useState(null);
    const { currentUser, loading: authLoading } = useAuth();

    if (authLoading) {
        return <LoadingScreen message="Authenticating..." />;
    }

    if (!currentUser) {
        return <AuthScreen />;
    }

    if (selectedWorldId) {
        return (
            <GameProvider worldId={selectedWorldId}>
                <AllianceProvider>
                    <GameController onBackToWorlds={() => setSelectedWorldId(null)} />
                </AllianceProvider>
            </GameProvider>
        );
    }
    
    return <WorldSelectionScreen onWorldSelected={setSelectedWorldId} />;
}

export default App;