// src/hooks/actions/useWorkerActions.js
import { useGame } from '../../contexts/GameContext';

export const useWorkerActions = ({ cityGameState, saveGameState, getMaxWorkerSlots, calculateUsedPopulation, getFarmCapacity, setMessage }) => {
    const { gameSettings } = useGame();

    const handleAddWorker = async (buildingId) => {
        const newGameState = { ...cityGameState };
        if (!newGameState.buildings[buildingId].workers) {
            newGameState.buildings[buildingId].workers = 0;
        }
        newGameState.buildings[buildingId].workers += 1;
        await saveGameState(newGameState);
    };
    
    // #comment Fixed a bug where removing a worker from a building with no workers assigned would result in NaN.
    const handleRemoveWorker = async (buildingId) => {
        const newGameState = { ...cityGameState };
        const currentWorkers = newGameState.buildings[buildingId].workers || 0;
        newGameState.buildings[buildingId].workers = Math.max(0, currentWorkers - 1);
        await saveGameState(newGameState);
    };

    // #comment Applies worker presets, prioritizing removals and then adding workers up to the population limit.
    const applyWorkerPresets = async () => {
        const presets = gameSettings.workerPresets;
        if (!presets) {
            setMessage("Worker presets not configured.");
            return;
        }

        const buildingsToUpdate = ['timber_camp', 'quarry', 'silver_mine'];
        
        const maxPopulation = getFarmCapacity(cityGameState.buildings.farm.level);
        const usedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units, cityGameState.specialBuilding);
        let availablePopulation = maxPopulation - usedPopulation;

        const cappedGameState = JSON.parse(JSON.stringify(cityGameState));
        let appliedChanges = false;

        // Prioritize removing workers first to free up population
        for (const buildingId of buildingsToUpdate) {
             const building = cappedGameState.buildings[buildingId];
             if (!building || building.level === 0) continue;
             const currentWorkers = building.workers || 0;
             const presetWorkers = presets[buildingId] || 0;
             const targetWorkers = Math.min(presetWorkers, getMaxWorkerSlots(building.level));
             const diff = targetWorkers - currentWorkers;
             if (diff < 0) {
                 building.workers = targetWorkers;
                 availablePopulation -= diff * 20; // This will add to availablePopulation
                 appliedChanges = true;
             }
        }

        // Then add workers with the available population
        for (const buildingId of buildingsToUpdate) {
            const building = cappedGameState.buildings[buildingId];
            if (!building || building.level === 0) continue;
            const currentWorkers = building.workers || 0;
            const presetWorkers = presets[buildingId] || 0;
            const maxSlots = getMaxWorkerSlots(building.level);
            const targetWorkers = Math.min(presetWorkers, maxSlots);
            const diff = targetWorkers - currentWorkers;

            if (diff > 0) {
                const workersToAdd = Math.min(diff, Math.floor(availablePopulation / 20));
                if (workersToAdd > 0) {
                    building.workers += workersToAdd;
                    availablePopulation -= workersToAdd * 20;
                    appliedChanges = true;
                }
            }
        }
        
        if (appliedChanges) {
            await saveGameState(cappedGameState);
            setMessage("Applied presets with available population.");
        } else {
            setMessage("Worker distribution already matches presets or no population is available to add more.");
        }
    };

    return { handleAddWorker, handleRemoveWorker, applyWorkerPresets };
};
