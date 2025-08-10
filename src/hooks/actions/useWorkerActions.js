// src/hooks/actions/useWorkerActions.js

export const useWorkerActions = ({ cityGameState, saveGameState }) => {
    const handleAddWorker = async (buildingId) => {
        const newGameState = { ...cityGameState };
        if (!newGameState.buildings[buildingId].workers) {
            newGameState.buildings[buildingId].workers = 0;
        }
        newGameState.buildings[buildingId].workers += 1;
        await saveGameState(newGameState);
    };
    
    const handleRemoveWorker = async (buildingId) => {
        const newGameState = { ...cityGameState };
        newGameState.buildings[buildingId].workers -= 1;
        await saveGameState(newGameState);
    };

    return { handleAddWorker, handleRemoveWorker };
};
