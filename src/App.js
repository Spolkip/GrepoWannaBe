import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { GameProvider, useGame } from './contexts/GameContext';
import { AllianceProvider } from './contexts/AllianceContext';
import AuthScreen from './components/AuthScreen';
import SelectionScreen from './components/SelectionScreen';
import Game from './components/Game';
import WorldSelectionScreen from './components/WorldSelectionScreen';

const GameController = ({ onBackToWorlds }) => {
    const { playerHasChosenFaction, worldState, loading: gameLoading } = useGame();

    if (gameLoading) {
        return <div className="text-white text-center p-10">Loading World Data...</div>;
    }

    if (!worldState) {
        return (
            <div className="text-white text-center p-10">
                <p>Error: Could not load the selected world.</p>
                <button onClick={onBackToWorlds} className="btn btn-primary mt-4">Back to World Selection</button>
            </div>
        );
    }

    if (playerHasChosenFaction) {
        return <Game onBackToWorlds={onBackToWorlds} />;
    }
    
    return <SelectionScreen />;
};

function App() {
    const [selectedWorldId, setSelectedWorldId] = useState(null);
    const { currentUser, loading: authLoading } = useAuth();

    if (authLoading) {
        return <div className="text-white text-center p-10">Authenticating...</div>;
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