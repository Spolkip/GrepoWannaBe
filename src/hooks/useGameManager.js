// src/hooks/useGameManager.js
import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useWorldClock } from './useWorldClock';
import { useMovementProcessor } from './useMovementProcessor';

/**
 * #comment Manages the main game view, chat state, and background processes.
 */
export const useGameManager = () => {
    const { worldId, activeCity, worldState } = useGame();
    const [view, setView] = useState('city');
    const [isChatOpen, setIsChatOpen] = useState(false);

    // #comment Custom hooks to handle complex game logic
    useWorldClock(worldId, worldState);
    useMovementProcessor(worldId);

    const showMap = () => setView('map');
    const showCity = () => setView('city');

    return {
        view,
        isChatOpen,
        setIsChatOpen,
        showMap,
        showCity,
        isLoading: !activeCity, // #comment The game is loading if there is no active city
        worldId
    };
};
