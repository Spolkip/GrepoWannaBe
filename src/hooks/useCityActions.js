// src/hooks/useCityActions.js
import { collection, doc, query, where, limit, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import researchConfig from '../gameData/research.json';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique IDs

/**
 * #comment A custom hook to encapsulate all city-related actions and logic.
 */
export const useCityActions = ({
    cityGameState, setCityGameState, saveGameState, worldId, userProfile, currentUser,
    getUpgradeCost, getResearchCost, getFarmCapacity, calculateUsedPopulation, isInstantUnits,
    setMessage, openModal, closeModal, setModalState,
    setIsInstantBuild, setIsInstantResearch, setIsInstantUnits
}) => {

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
        const cost = getUpgradeCost(buildingId, nextLevelToQueue);
        const currentUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units, currentState.specialBuilding);
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const newTotalPopulation = currentUsedPopulation + cost.population;

        if (
            currentState.resources.wood >= cost.wood &&
            currentState.resources.stone >= cost.stone &&
            currentState.resources.silver >= cost.silver &&
            newTotalPopulation <= maxPopulation
        ) {
            const newGameState = JSON.parse(JSON.stringify(currentState));
            newGameState.resources.wood -= cost.wood;
            newGameState.resources.stone -= cost.stone;
            newGameState.resources.silver -= cost.silver;

            // Add research points for academy upgrades
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
        }
        else {
            setMessage(newTotalPopulation > maxPopulation ? 'Not enough population capacity!' : 'Not enough resources to upgrade!');
        }
    };

    const handleCancelBuild = async (itemIndex) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.buildQueue || itemIndex < 0 || itemIndex >= currentState.buildQueue.length) {
            return;
        }

        const newQueue = [...currentState.buildQueue];
        const canceledTask = newQueue.splice(itemIndex, 1)[0];
        
        let cost;
        if (canceledTask.isSpecial) {
            cost = { wood: 15000, stone: 15000, silver: 15000, population: 60 };
        } else {
            cost = getUpgradeCost(canceledTask.buildingId, canceledTask.level);
        }

        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + cost.wood,
            stone: currentState.resources.stone + cost.stone,
            silver: currentState.resources.silver + cost.silver,
        };
        
        const newGameState = { ...currentState, resources: newResources, buildQueue: newQueue };

        if (canceledTask.buildingId === 'academy' && !canceledTask.isSpecial) {
            newGameState.researchPoints = (newGameState.researchPoints || 0) - 4;
        }

        for (let i = itemIndex; i < newQueue.length; i++) {
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            const taskToUpdate = newQueue[i];
            
            let taskTime;
            if (taskToUpdate.isSpecial) {
                taskTime = 7200;
            } else {
                taskTime = getUpgradeCost(taskToUpdate.buildingId, taskToUpdate.level).time;
            }
            
            const newEndTime = new Date(previousTaskEndTime + taskTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }
        
        await saveGameState(newGameState);
        setCityGameState(newGameState);
    };
    
    const handleDemolish = async (buildingId) => {
        const currentState = cityGameState;
        const building = currentState.buildings[buildingId];
        if (!building || building.level === 0) {
            setMessage("Building not found or already at level 0.");
            return;
        }

        const cost = getUpgradeCost(buildingId, building.level);
        const refund = {
            wood: Math.floor(cost.wood * 0.5),
            stone: Math.floor(cost.stone * 0.5),
            silver: Math.floor(cost.silver * 0.5),
        };
        
        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood += refund.wood;
        newGameState.resources.stone += refund.stone;
        newGameState.resources.silver += refund.silver;
        newGameState.buildings[buildingId].level = 0;

        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage(`${buildingConfig[buildingId].name} has been demolished.`);
    };

    const handleStartResearch = async (researchId) => {
        const currentState = cityGameState;
        if (!currentState || !researchConfig[researchId]) return;

        const currentQueue = currentState.researchQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Research queue is full (max 5).");
            return;
        }

        const researchData = researchConfig[researchId];
        const { cost, requirements } = researchData;

        if (currentState.research[researchId]) {
            setMessage("Research already completed.");
            return;
        }
        if (currentQueue.some(item => item.researchId === researchId)) {
            setMessage("Research is already in the queue.");
            return;
        }
        if (requirements.academy && currentState.buildings.academy.level < requirements.academy) {
            setMessage(`Requires Academy Level ${requirements.academy}.`);
            return;
        }
        if (requirements.research && !currentState.research[requirements.research]) {
            setMessage(`Requires "${researchConfig[requirements.research].name}" research first.`);
            return;
        }
        if (
            currentState.resources.wood < cost.wood ||
            currentState.resources.stone < cost.stone ||
            currentState.resources.silver < cost.silver ||
            (currentState.researchPoints || 0) < (cost.points || 0)
        ) {
            setMessage("Not enough resources or research points.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;
        newGameState.researchPoints = (newGameState.researchPoints || 0) - (cost.points || 0);

        let lastEndTime = Date.now();
        if (currentQueue.length > 0) {
            const lastQueueItem = currentQueue[currentQueue.length - 1];
            if (lastQueueItem.endTime) {
                lastEndTime = lastQueueItem.endTime.toDate
                    ? lastQueueItem.endTime.toDate().getTime()
                    : new Date(lastQueueItem.endTime).getTime();
            }
        }
        const researchTime = getResearchCost(researchId).time;
        const endTime = new Date(lastEndTime + researchTime * 1000);

        const newQueueItem = {
            researchId,
            endTime: endTime,
        };
        newGameState.researchQueue = [...currentQueue, newQueueItem];

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
            setMessage(`Research for "${researchData.name}" started.`);
        }
        catch (error) {
            console.error("Error starting research:", error);
            setMessage("Could not start research. Please try again.");
        }
    };

    const handleCancelResearch = async (itemIndex) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.researchQueue || itemIndex < 0 || itemIndex >= currentState.researchQueue.length) {
            return;
        }
        const newQueue = [...currentState.researchQueue];
        const canceledTask = newQueue.splice(itemIndex, 1)[0];
        const researchData = researchConfig[canceledTask.researchId];

        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + researchData.cost.wood,
            stone: currentState.resources.stone + researchData.cost.stone,
            silver: currentState.resources.silver + researchData.cost.silver,
        };
        const newResearchPoints = (currentState.researchPoints || 0) + (researchData.cost.points || 0);

        for (let i = itemIndex; i < newQueue.length; i++) {
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            const taskToUpdate = newQueue[i];
            const taskResearchTime = getResearchCost(taskToUpdate.researchId).time;
            const newEndTime = new Date(previousTaskEndTime + taskResearchTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        const newGameState = { ...currentState, resources: newResources, researchQueue: newQueue, researchPoints: newResearchPoints };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
    };

    const handleCancelTrain = async (canceledItem, queueType) => {
        const currentState = cityGameState;
        let queueName;
        let costField;
        let refundField;
    
        switch (queueType) {
            case 'barracks':
            case 'shipyard':
            case 'divineTemple':
                queueName = `${queueType}Queue`;
                costField = 'cost';
                refundField = 'units';
                break;
            case 'heal':
                queueName = 'healQueue';
                costField = 'heal_cost';
                refundField = 'wounded';
                break;
            default:
                console.error("Invalid queueType for cancellation:", queueType);
                setMessage("Error: Invalid queue type for cancellation.");
                return;
        }
    
        if (!currentState || !currentState[queueName]) {
            return;
        }
    
        const currentQueue = [...currentState[queueName]];
        const itemIndex = currentQueue.findIndex((item) => item.id === canceledItem.id);
    
        if (itemIndex === -1) {
            console.error("Item not found in queue for cancellation:", canceledItem);
            setMessage("Error: Item not found in queue.");
            return;
        }
    
        const newQueue = [...currentQueue];
        const removedTask = newQueue.splice(itemIndex, 1)[0];
        const unit = unitConfig[removedTask.unitId];
    
        if (!unit) {
            console.error("Unit not found for canceled task:", removedTask.unitId);
            setMessage("Error: Unit data missing for canceled task.");
            return;
        }
    
        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + (unit[costField]?.wood || 0) * removedTask.amount,
            stone: currentState.resources.stone + (unit[costField]?.stone || 0) * removedTask.amount,
            silver: currentState.resources.silver + (unit[costField]?.silver || 0) * removedTask.amount,
        };
    
        const newRefundUnits = { ...currentState[refundField] };
        if (queueType === 'heal') {
            newRefundUnits[removedTask.unitId] = (newRefundUnits[removedTask.unitId] || 0) + removedTask.amount;
        }
    
        for (let i = itemIndex; i < newQueue.length; i++) {
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            
            const taskToUpdate = newQueue[i];
            const taskUnit = unitConfig[taskToUpdate.unitId];
            const taskTime = (queueType === 'heal' ? taskUnit.heal_time : taskUnit.cost.time) * taskToUpdate.amount;
            const newEndTime = new Date(previousTaskEndTime + taskTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }
    
        const newGameState = { ...currentState, resources: newResources, [refundField]: newRefundUnits, [queueName]: newQueue };
    
        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        } catch (error) {
            console.error("Error cancelling training/healing:", error);
            setMessage("Could not cancel. Please try again.");
        }
    };
const handleTrainTroops = async (unitId, amount) => {
    const currentState = cityGameState;
    if (!currentState || !worldId || amount <= 0) return;

    const unit = unitConfig[unitId];
    if (!unit) {
        setMessage("Invalid unit type");
        return;
    }

    let queueName;
    let requiredBuildingLevel = 0;
    
    if (unit.type === 'naval') {
        queueName = 'shipyardQueue';
        requiredBuildingLevel = currentState.buildings.shipyard?.level || 0;
        if (requiredBuildingLevel === 0) {
            setMessage("Naval units can only be built in the Shipyard.");
            return;
        }
    } else if (unit.mythical) {
        queueName = 'divineTempleQueue';
        requiredBuildingLevel = currentState.buildings.divine_temple?.level || 0;
        if (requiredBuildingLevel === 0) {
            setMessage("Mythical units can only be trained in the Divine Temple.");
            return;
        }
    } else if (unit.type === 'land') {
        queueName = 'barracksQueue';
        requiredBuildingLevel = currentState.buildings.barracks?.level || 0;
        if (requiredBuildingLevel === 0) {
            setMessage("Land units can only be trained in the Barracks.");
            return;
        }
    } else {
        setMessage("Unknown unit type.");
        return;
    }

    const currentQueue = currentState[queueName] || [];
    if (currentQueue.length >= 5) {
        setMessage("Unit training queue is full (max 5).");
        return;
    }

    const totalCost = {
        wood: unit.cost.wood * amount,
        stone: unit.cost.stone * amount,
        silver: unit.cost.silver * amount,
        population: unit.cost.population * amount,
        favor: unit.cost.favor ? unit.cost.favor * amount : 0,
    };

    let effectiveUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units, currentState.specialBuilding);
    Object.values(currentState.barracksQueue || []).forEach(task => { effectiveUsedPopulation += (unitConfig[task.unitId]?.cost.population || 0) * task.amount; });
    Object.values(currentState.shipyardQueue || []).forEach(task => { effectiveUsedPopulation += (unitConfig[task.unitId]?.cost.population || 0) * task.amount; });
    Object.values(currentState.divineTempleQueue || []).forEach(task => { effectiveUsedPopulation += (unitConfig[task.unitId]?.cost.population || 0) * task.amount; });

    const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
    const availablePopulation = maxPopulation - effectiveUsedPopulation;

    if (currentState.resources.wood < totalCost.wood) {
        setMessage(`Need ${totalCost.wood - currentState.resources.wood} more wood`);
        return;
    }
    if (currentState.resources.stone < totalCost.stone) {
        setMessage(`Need ${totalCost.stone - currentState.resources.stone} more stone`);
        return;
    }
    if (currentState.resources.silver < totalCost.silver) {
        setMessage(`Need ${totalCost.silver - currentState.resources.silver} more silver`);
        return;
    }
    if (availablePopulation < totalCost.population) {
        setMessage(`Need ${totalCost.population - availablePopulation} more population capacity`);
        return;
    }
    if (unit.mythical && currentState.worship[currentState.god] < totalCost.favor) {
        setMessage(`Need ${totalCost.favor - currentState.worship[currentState.god]} more favor for ${currentState.god}`);
        return;
    }

    const newGameState = JSON.parse(JSON.stringify(currentState));
    newGameState.resources.wood -= totalCost.wood;
    newGameState.resources.stone -= totalCost.stone;
    newGameState.resources.silver -= totalCost.silver;
    if (unit.mythical) {
        newGameState.worship[newGameState.god] -= totalCost.favor;
    }

    const activeQueueForType = currentQueue.filter(task => {
        const taskEndTime = task.endTime?.toDate ? task.endTime.toDate() : new Date(task.endTime);
        return taskEndTime.getTime() > Date.now();
    });

    let lastEndTime = Date.now();
    if (activeQueueForType.length > 0) {
        const lastItem = activeQueueForType[activeQueueForType.length - 1];
        const lastItemEndTime = lastItem.endTime?.toDate ? lastItem.endTime.toDate() : new Date(lastItem.endTime);
        lastEndTime = lastItemEndTime.getTime();
    }

    const trainingTime = isInstantUnits ? 1 : unit.cost.time * amount;
    const endTime = new Date(lastEndTime + trainingTime * 1000);

    const newQueueItem = {
        id: uuidv4(),
        unitId,
        amount,
        endTime: endTime,
    };
    newGameState[queueName] = [...activeQueueForType, newQueueItem];

    try {
        await saveGameState(newGameState);
        setCityGameState(newGameState);
    } catch (error) {
        console.error("Error adding to unit queue:", error);
        setMessage("Could not start training. Please try again.");
    }
};

    const handleHealTroops = async (unitsToHeal) => {
        const currentState = cityGameState;
        if (!currentState || !worldId || Object.keys(unitsToHeal).length === 0) return;
    
        const newGameState = JSON.parse(JSON.stringify(currentState));
        let currentQueue = newGameState.healQueue || [];
        
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const usedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units, currentState.specialBuilding);
        const availablePopulation = maxPopulation - usedPopulation;
        let populationToHeal = 0;
        for (const unitId in unitsToHeal) {
            const amount = unitsToHeal[unitId];
            const unit = unitConfig[unitId];
            populationToHeal += (unit.cost.population || 0) * amount;
        }
        if (availablePopulation < populationToHeal) {
            setMessage("Not enough available population to heal these units.");
            return;
        }
    
        const tasksToAdd = [];
        const totalCost = { wood: 0, stone: 0, silver: 0 };
    
        for (const unitId in unitsToHeal) {
            const amount = unitsToHeal[unitId];
            if (amount > 0) {
                const unit = unitConfig[unitId];
                tasksToAdd.push({
                    unitId,
                    amount,
                    cost: {
                        wood: (unit.heal_cost.wood || 0) * amount,
                        stone: (unit.heal_cost.stone || 0) * amount,
                        silver: (unit.heal_cost.silver || 0) * amount,
                    },
                    time: (unit.heal_time || 0) * amount,
                });
                totalCost.wood += tasksToAdd[tasksToAdd.length - 1].cost.wood;
                totalCost.stone += tasksToAdd[tasksToAdd.length - 1].cost.stone;
                totalCost.silver += tasksToAdd[tasksToAdd.length - 1].cost.silver;
            }
        }
    
        if (tasksToAdd.length + currentQueue.length > 5) {
            setMessage("Not enough space in the healing queue.");
            return;
        }
    
        if (
            currentState.resources.wood >= totalCost.wood &&
            currentState.resources.stone >= totalCost.stone &&
            currentState.resources.silver >= totalCost.silver
        ) {
            newGameState.resources.wood -= totalCost.wood;
            newGameState.resources.stone -= totalCost.stone;
            newGameState.resources.silver -= totalCost.silver;
    
            const newWounded = { ...newGameState.wounded };
            for (const task of tasksToAdd) {
                newWounded[task.unitId] -= task.amount;
                if (newWounded[task.unitId] <= 0) {
                    delete newWounded[task.unitId];
                }
            }
            newGameState.wounded = newWounded;
    
            let lastEndTime = Date.now();
            if (currentQueue.length > 0) {
                const lastQueueItem = currentQueue[currentQueue.length - 1];
                lastEndTime = lastQueueItem.endTime.toDate ? lastQueueItem.endTime.toDate().getTime() : new Date(lastQueueItem.endTime).getTime();
            }
    
            for (const task of tasksToAdd) {
                const endTime = new Date(lastEndTime + task.time * 1000);
                const newQueueItem = {
                    id: uuidv4(),
                    unitId: task.unitId,
                    amount: task.amount,
                    endTime,
                };
                currentQueue.push(newQueueItem);
                lastEndTime = endTime.getTime();
            }
            newGameState.healQueue = currentQueue;
    
            try {
                await saveGameState(newGameState);
                setCityGameState(newGameState);
                setMessage(`Healing started.`);
            } catch (error) {
                console.error("Error starting healing:", error);
                setMessage("Could not start healing. Please try again.");
            }
        } else {
            setMessage("Not enough resources to heal troops!");
        }
    };

    const handleCancelHeal = async (itemIndex) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.healQueue || itemIndex < 0 || itemIndex >= currentState.healQueue.length) {
            return;
        }

        const newQueue = [...currentState.healQueue];
        const canceledTask = newQueue.splice(itemIndex, 1)[0];
        const unit = unitConfig[canceledTask.unitId];

        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + (unit.heal_cost.wood * canceledTask.amount),
            stone: currentState.resources.stone + (unit.heal_cost.stone * canceledTask.amount),
            silver: currentState.resources.silver + (unit.heal_cost.silver * canceledTask.amount),
        };
        
        const newWounded = { ...currentState.wounded };
        newWounded[canceledTask.unitId] = (newWounded[canceledTask.unitId] || 0) + canceledTask.amount;

        for (let i = itemIndex; i < newQueue.length; i++) {
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            
            const taskToUpdate = newQueue[i];
            const taskUnit = unitConfig[taskToUpdate.unitId];
            const taskTime = (taskUnit.heal_time || 0) * taskToUpdate.amount;
            const newEndTime = new Date(previousTaskEndTime + taskTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        const newGameState = { ...currentState, resources: newResources, wounded: newWounded, healQueue: newQueue };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
    };

    const handleFireTroops = async (unitsToFire) => {
        const currentState = cityGameState;
        if (!currentState || !worldId || Object.keys(unitsToFire).length === 0) return;

        const newGameState = JSON.parse(JSON.stringify(currentState));
        const newUnits = { ...newGameState.units };

        for (const unitId in unitsToFire) {
            const amount = unitsToFire[unitId];
            if (newUnits[unitId] && newUnits[unitId] >= amount) {
                newUnits[unitId] -= amount;
                if (newUnits[unitId] === 0) {
                    delete newUnits[unitId];
                }
            }
        }

        newGameState.units = newUnits;

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
            setMessage("Units dismissed.");
        } catch (error) {
            console.error("Error firing units:", error);
            setMessage("Could not dismiss units. Please try again.");
        }
    };

    const handleWorshipGod = async (godName) => {
        if (!cityGameState || !worldId || !godName) return;
        const newWorshipData = { ...(cityGameState.worship || {}) };
        if (newWorshipData[godName] === undefined) {
            newWorshipData[godName] = 0;
        }
        newWorshipData.lastFavorUpdate = Date.now();
        const newGameState = { ...cityGameState, god: godName, worship: newWorshipData };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        closeModal('isTempleMenuOpen');
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
            level: 1, // Special buildings are level 1
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
        
        newGameState.resources.wood += refund.wood;
        newGameState.resources.stone += refund.stone;
        newGameState.resources.silver += refund.silver;
        
        delete newGameState.specialBuilding;

        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage("The wonder has been demolished and half of its resources have been returned.");
    };

    const handleCheat = async (amounts, troop, warehouseLevels, instantBuild, unresearchId, instantResearch, instantUnits, favorAmount, foundSecondCity) => {
        if (!cityGameState || !userProfile?.is_admin) return;

        if (foundSecondCity) {
            if (!worldId) {
                setMessage("Cannot found city: World ID is missing.");
                console.error("worldId is missing in handleCheat");
                return;
            }
            setMessage('Finding a suitable location for your new city...');
            
            const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
            const q = query(citySlotsRef, where('ownerId', '==', null), limit(10));
            let selectedSlot = null;
            try {
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const randomDoc = querySnapshot.docs[Math.floor(Math.random() * querySnapshot.docs.length)];
                    selectedSlot = { id: randomDoc.id, ...randomDoc.data() };
                }
            } catch (error) {
                console.error("Error finding an empty slot:", error);
                setMessage('Error finding a location.');
                return;
            }

            if (!selectedSlot) {
                setMessage('Could not find an available city slot. This world might be full.');
                return;
            }

            setMessage(`Location found at (${selectedSlot.x}, ${selectedSlot.y}). Founding city...`);

            const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', selectedSlot.id);
            const newCityDocRef = doc(collection(db, 'users', currentUser.uid, 'games', worldId, 'cities'));

            const batch = writeBatch(db);
            
            const citiesCollectionRef = collection(db, 'users', currentUser.uid, 'games', worldId, 'cities');
            const citiesSnapshot = await getDocs(citiesCollectionRef);
            const existingCityNames = citiesSnapshot.docs.map(doc => doc.data().cityName);
            
            const baseName = `${userProfile.username}'s Colony`;
            let finalCityName = baseName;
            
            if (existingCityNames.includes(finalCityName)) {
                let count = 2;
                let newName;
                do {
                    newName = `${baseName} ${count}`;
                    count++;
                } while (existingCityNames.includes(newName));
                finalCityName = newName;
            }

            batch.update(citySlotRef, {
                ownerId: currentUser.uid,
                ownerUsername: userProfile.username,
                cityName: finalCityName
            });

            const initialBuildings = {};
            Object.keys(buildingConfig).forEach(id => {
                initialBuildings[id] = { level: 0 };
            });
            ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave'].forEach(id => {
                initialBuildings[id].level = 1;
            });

            const newCityData = {
                id: newCityDocRef.id,
                slotId: selectedSlot.id,
                x: selectedSlot.x,
                y: selectedSlot.y,
                islandId: selectedSlot.islandId,
                cityName: finalCityName,
                playerInfo: cityGameState.playerInfo,
                resources: { wood: 1000, stone: 1000, silver: 500 },
                buildings: initialBuildings,
                units: {},
                wounded: {},
                research: {},
                worship: {},
                cave: { silver: 0 },
                buildQueue: [],
                barracksQueue: [],
                shipyardQueue: [],
                divineTempleQueue: [],
                healQueue: [],
                lastUpdated: Date.now(),
            };
            
            batch.set(newCityDocRef, newCityData);

            try {
                await batch.commit();
                setMessage(`New city "${finalCityName}" founded at (${selectedSlot.x}, ${selectedSlot.y})!`);
            } catch (error) {
                console.error("Error founding city: ", error);
                setMessage(`Failed to found city: ${error.message}`);
            }
            return;
        }
        
        setIsInstantBuild(instantBuild);
        setIsInstantResearch(instantResearch);
        setIsInstantUnits(instantUnits);

        const newGameState = { ...cityGameState };
        newGameState.resources.wood += amounts.wood;
        newGameState.resources.stone += amounts.stone;
        newGameState.resources.silver += amounts.silver;

        if (amounts.population > 0) {
            const farmLevel = newGameState.buildings.farm.level;
            newGameState.buildings.farm.level = farmLevel + amounts.population;
        }
        if (troop.amount > 0) {
            newGameState.units[troop.unit] = (newGameState.units[troop.unit] || 0) + troop.amount;
        }
        if (warehouseLevels > 0) {
            newGameState.buildings.warehouse.level += warehouseLevels;
        }
        if (unresearchId && newGameState.research[unresearchId]) {
            delete newGameState.research[unresearchId];
            setMessage(`Research "${researchConfig[unresearchId]?.name}" unreasearched!`);
        } else if (unresearchId) {
            setMessage(`Research "${researchConfig[unresearchId]?.name}" is not researched.`);
        }
        if (favorAmount > 0 && newGameState.god) {
            const currentFavor = newGameState.worship[newGameState.god] || 0;
            const templeLevel = newGameState.buildings.temple?.level || 0;
            const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;
            newGameState.worship[newGameState.god] = Math.min(maxFavor, currentFavor + favorAmount);
            setMessage(`Added ${favorAmount} favor to ${newGameState.god}!`);
        } else if (favorAmount > 0 && !newGameState.god) {
            setMessage("No god is currently worshipped to add favor.");
        }

        await saveGameState(newGameState);
        setMessage("Admin cheat applied!");
    };

    const handlePlotClick = (buildingId) => {
        const buildingData = cityGameState.buildings[buildingId];
        if (!buildingData || buildingData.level === 0) {
            openModal('isSenateViewOpen');
            return;
        }
        switch (buildingId) {
            case 'senate': openModal('isSenateViewOpen'); break;
            case 'barracks': openModal('isBarracksMenuOpen'); break;
            case 'shipyard': openModal('isShipyardMenuOpen'); break;
            case 'temple': openModal('isTempleMenuOpen'); break;
            case 'divine_temple': openModal('isDivineTempleMenuOpen'); break;
            case 'cave': openModal('isCaveMenuOpen'); break;
            case 'academy': openModal('isAcademyMenuOpen'); break;
            case 'hospital': openModal('isHospitalMenuOpen'); break;
            case 'market': openModal('isMarketMenuOpen'); break;
            default: setModalState(prev => ({ ...prev, selectedBuildingId: buildingId })); break;
        }
    };

    const handleCastSpell = async (power) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor to cast this spell.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.worship[currentState.god] -= power.favorCost;

        switch (power.effect.type) {
            case 'add_resources':
                newGameState.resources[power.effect.resource] = (newGameState.resources[power.effect.resource] || 0) + power.effect.amount;
                break;
            case 'add_multiple_resources':
                for (const resource in power.effect.resources) {
                    newGameState.resources[resource] = (newGameState.resources[resource] || 0) + power.effect.resources[resource];
                }
                break;
            default:
                setMessage("This spell's effect is not yet implemented.");
                return;
        }

        try {
            await saveGameState(newGameState);
            setCityGameState(newGameState);
            setMessage(`${power.name} has been cast!`);
            closeModal('isDivinePowersOpen');
        } catch (error) {
            console.error("Error casting spell:", error);
            setMessage("Failed to cast the spell. Please try again.");
        }
    };

    return {
        handleAddWorker, handleRemoveWorker, handleUpgrade, handleCancelBuild,
        handleStartResearch, handleCancelResearch, handleCancelTrain, handleTrainTroops,
        handleHealTroops, handleCancelHeal, handleFireTroops, handleWorshipGod,
        handleCheat, handlePlotClick, handleCastSpell, handleBuildSpecialBuilding, handleDemolishSpecialBuilding,
        handleDemolish
    };
};
