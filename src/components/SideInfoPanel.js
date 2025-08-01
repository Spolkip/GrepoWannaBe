// src/components/SideInfoPanel.js

import React from 'react';
import WorshipDisplay from './city/WorshipDisplay';
import TroopDisplay from './TroopDisplay';

const SideInfoPanel = ({ gameState, className, onOpenPowers }) => {
    if (!gameState) {
        return null;
    }

    return (
        <div className={className}>
            <WorshipDisplay
                godName={gameState.god}
                playerReligion={gameState.playerInfo.religion}
                worship={gameState.worship}
                buildings={gameState.buildings}
                onOpenPowers={onOpenPowers}
            />
            <TroopDisplay units={gameState.units || {}} />
        </div>
    );
};

export default SideInfoPanel;