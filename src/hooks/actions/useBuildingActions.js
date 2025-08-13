// src/hooks/actions/useBuildingActions.js
import { v4 as uuidv4 } from 'uuid';
import buildingConfig from '../../gameData/buildings.json';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

export const useBuildingActions = ({
    cityGameState, setCityGameState, saveGameState, worldId,
    getUpgradeCost, getFarmCapacity, calculateUsedPopulation, isInstantBuild,
    setMessage, closeModal, getWarehouseCapacity // #comment Import getWarehouseCapacity
}) => {
    const { currentUser } = useAuth();

    const handleUpgrade = async (buildingId) => {
        const currentState = cityGameState;
        if (!currentState || !worldId) return;

        const currentQueue = currentState.buildQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }

        const building = currentState.buildings[buildingId] || { level: 0 };
        let effectiveCurrentLevel = building.level;
        currentQueue.forEach(task => {
            if (task.buildingId === buildingId && task.level > effectiveCurrentLevel) {
                effectiveCurrentLevel = task.level;
            }
        });

        const nextLevelToQueue = effectiveCurrentLevel + 1;
        const config = buildingConfig[buildingId];
        if (config && nextLevelToQueue > config.maxLevel) {
            setMessage("Building is already at its maximum level or queued to be.");
            return;
        }
        
        const cost = getUpgradeCost(buildingId, nextLevelToQueue);
        
        const hasEnoughResources = currentState.resources.wood >= cost.wood &&
                                   currentState.resources.stone >= cost.stone &&
                                   currentState.resources.silver >= cost.silver;

        if (!hasEnoughResources) {
            setMessage('Not enough resources to upgrade!');
            return;
        }

        const currentUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units, currentState.specialBuilding);
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const newTotalPopulation = currentUsedPopulation + cost.population;
        const hasEnoughPopulation = newTotalPopulation <= maxPopulation;

        if (!hasEnoughPopulation && buildingId !== 'farm' && buildingId !== 'warehouse') {
            setMessage('Not enough population capacity!');
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;

        if (buildingId === 'academy') {
            newGameState.researchPoints = (newGameState.researchPoints || 0) + 4;
        }

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }
        const endTime = new Date(lastEndTime + cost.time * 1000);

        const newQueueItem = {
            id: uuidv4(),
            buildingId,
            level: nextLevelToQueue,
            endTime: endTime,
        };
        newGameState.buildQueue = [...currentQueue, newQueueItem];

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        }
        catch (error) {
            console.error("Error adding to build queue:", error);
            setMessage("Could not start upgrade. Please try again.");
        }
    };

    const handleCancelBuild = async (itemToCancel) => {
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', cityGameState.id);
        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) {
                    throw new Error("City data not found.");
                }
                const currentState = cityDoc.data();
                const currentQueue = currentState.buildQueue || [];
                const itemIndex = currentQueue.findIndex(item => item.id === itemToCancel.id);

                if (itemIndex === -1) {
                    throw new Error("Item not found in queue.");
                }
                if (itemIndex !== currentQueue.length - 1) {
                    throw new Error("You can only cancel the last item in the queue.");
                }

                const newQueue = [...currentQueue];
                const canceledTask = newQueue.splice(itemIndex, 1)[0];
                const newResources = { ...currentState.resources };
                let newResearchPoints = currentState.researchPoints || 0;

                if (canceledTask.type !== 'demolish') {
                    let cost;
                    if (canceledTask.isSpecial) {
                        cost = { wood: 15000, stone: 15000, silver: 15000, population: 60 };
                    } else {
                        cost = getUpgradeCost(canceledTask.buildingId, canceledTask.level);
                    }
                    
                    // #comment Add warehouse capacity check before refunding
                    const capacity = getWarehouseCapacity(currentState.buildings.warehouse.level);
                    newResources.wood = Math.min(capacity, newResources.wood + cost.wood);
                    newResources.stone = Math.min(capacity, newResources.stone + cost.stone);
                    newResources.silver = Math.min(capacity, newResources.silver + cost.silver);

                    if (canceledTask.buildingId === 'academy' && !canceledTask.isSpecial) {
                        newResearchPoints -= 4;
                    }
                }

                transaction.update(cityDocRef, {
                    buildQueue: newQueue,
                    resources: newResources,
                    researchPoints: newResearchPoints
                });
            });
        } catch (error) {
            console.error("Error cancelling build:", error);
            setMessage(error.message);
        }
    };
    
    const handleDemolish = async (buildingId) => {
        const currentState = cityGameState;
        if (!currentState || !worldId) return;
    
        const currentQueue = currentState.buildQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }
    
        const building = currentState.buildings[buildingId];
        if (!building) {
            setMessage("Building not found.");
            return;
        }
    
        let finalLevel = building.level;
        const tasksForBuilding = currentQueue.filter(task => task.buildingId === buildingId);
        if (tasksForBuilding.length > 0) {
            finalLevel = tasksForBuilding[tasksForBuilding.length - 1].level;
        }
    
        if (finalLevel <= 0) {
            setMessage("Building is already at or being demolished to level 0.");
            return;
        }
    
        const levelToDemolishFrom = finalLevel;
        const targetLevel = finalLevel - 1;
    
        const costConfig = buildingConfig[buildingId].baseCost;
        const calculatedTime = Math.floor(costConfig.time * Math.pow(1.25, levelToDemolishFrom - 1));
        const demolitionTime = isInstantBuild ? 1 : Math.floor(calculatedTime / 2);
    
        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }
        const endTime = new Date(lastEndTime + demolitionTime * 1000);
    
        const newQueueItem = {
            id: uuidv4(),
            type: 'demolish',
            buildingId,
            level: targetLevel,
            currentLevel: levelToDemolishFrom,
            endTime: endTime,
        };
    
        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.buildQueue = [...currentQueue, newQueueItem];
    
        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        } catch (error) {
            console.error("Error adding demolition to build queue:", error);
            setMessage("Could not start demolition. Please try again.");
        }
    };

    const handleBuildSpecialBuilding = async (buildingId, cost) => {
        const currentState = cityGameState;
        
        if (currentState.specialBuilding || (currentState.buildQueue || []).some(task => task.isSpecial)) {
            setMessage("You can only build one special building per city.");
            return;
        }

        const currentQueue = currentState.buildQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }
        
        const currentUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units, currentState.specialBuilding);
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const availablePopulation = maxPopulation - currentUsedPopulation;

        if (availablePopulation < cost.population) {
            setMessage("Not enough population to construct this wonder.");
            return;
        }

        if (
            currentState.resources.wood < cost.wood ||
            currentState.resources.stone < cost.stone ||
            currentState.resources.silver < cost.silver
        ) {
            setMessage("Not enough resources to construct this wonder.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }
        const buildTimeInSeconds = 7200; // 2 hours for wonders
        const endTime = new Date(lastEndTime + buildTimeInSeconds * 1000);

        const newQueueItem = {
            id: uuidv4(),
            buildingId: buildingId,
            isSpecial: true,
            level: 1,
            endTime: endTime,
        };
        newGameState.buildQueue = [...currentQueue, newQueueItem];

        await saveGameState(newGameState);
        setCityGameState(newGameState);
        closeModal('isSpecialBuildingMenuOpen');
        setMessage("Construction of your wonder has begun!");
    };
    
    const handleDemolishSpecialBuilding = async () => {
        const currentState = cityGameState;
        if (!currentState.specialBuilding) {
            setMessage("No special building to demolish.");
            return;
        }

        const cost = { wood: 15000, stone: 15000, silver: 15000, population: 60 };
        const refund = {
            wood: Math.floor(cost.wood * 0.5),
            stone: Math.floor(cost.stone * 0.5),
            silver: Math.floor(cost.silver * 0.5),
        };

        const newGameState = JSON.parse(JSON.stringify(currentState));
        
        const capacity = getWarehouseCapacity(currentState.buildings.warehouse.level);
        newGameState.resources.wood = Math.min(capacity, newGameState.resources.wood + refund.wood);
        newGameState.resources.stone = Math.min(capacity, newGameState.resources.stone + refund.stone);
        newGameState.resources.silver = Math.min(capacity, newGameState.resources.silver + refund.silver);
        
        delete newGameState.specialBuilding;

        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage("The wonder has been demolished and half of its resources have been returned.");
    };

    return { handleUpgrade, handleCancelBuild, handleDemolish, handleBuildSpecialBuilding, handleDemolishSpecialBuilding };
};
