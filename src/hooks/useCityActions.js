// src/hooks/useCityActions.js
import { collection, doc, query, where, limit, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import researchConfig from '../gameData/research.json';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';

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
        const currentUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units);
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
        const cost = getUpgradeCost(canceledTask.buildingId, canceledTask.level);

        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + cost.wood,
            stone: currentState.resources.stone + cost.stone,
            silver: currentState.resources.silver + cost.silver,
        };

        for (let i = itemIndex; i < newQueue.length; i++) {
            // #comment Check if the previous item in the queue exists before trying to get its endTime
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            const taskToUpdate = newQueue[i];
            const taskCost = getUpgradeCost(taskToUpdate.buildingId, taskToUpdate.level);
            const newEndTime = new Date(previousTaskEndTime + taskCost.time * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        const newGameState = { ...currentState, resources: newResources, buildQueue: newQueue };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
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
            currentState.resources.silver < cost.silver
        ) {
            setMessage("Not enough resources to start research.");
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

        for (let i = itemIndex; i < newQueue.length; i++) {
            // #comment Check if the previous item in the queue exists before trying to get its endTime
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            const taskToUpdate = newQueue[i];
            const taskResearchTime = getResearchCost(taskToUpdate.researchId).time;
            const newEndTime = new Date(previousTaskEndTime + taskResearchTime * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        const newGameState = { ...currentState, resources: newResources, researchQueue: newQueue };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage(`Research for "${researchData.name}" canceled and resources refunded.`);
    };

    const handleCancelTrain = async (itemIndex) => {
        const currentState = cityGameState;
        if (!currentState || !currentState.unitQueue || itemIndex < 0 || itemIndex >= currentState.unitQueue.length) {
            return;
        }

        const newQueue = [...currentState.unitQueue];
        const canceledTask = newQueue.splice(itemIndex, 1)[0];
        const unit = unitConfig[canceledTask.unitId];

        const newResources = {
            ...currentState.resources,
            wood: currentState.resources.wood + (unit.cost.wood * canceledTask.amount),
            stone: currentState.resources.stone + (unit.cost.stone * canceledTask.amount),
            silver: currentState.resources.silver + (unit.cost.silver * canceledTask.amount),
        };

        for (let i = itemIndex; i < newQueue.length; i++) {
            // #comment Check if the previous item in the queue exists before trying to get its endTime
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1]?.endTime ? newQueue[i - 1].endTime.getTime() : Date.now());
            const taskToUpdate = newQueue[i];
            const taskUnit = unitConfig[taskToUpdate.unitId];
            const newEndTime = new Date(previousTaskEndTime + (isInstantUnits ? 1 : taskUnit.cost.time * taskToUpdate.amount) * 1000);
            newQueue[i] = { ...taskToUpdate, endTime: newEndTime };
        }

        const newGameState = { ...currentState, resources: newResources, unitQueue: newQueue };
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage(`Training for ${canceledTask.amount} ${unit.name}s canceled and resources refunded.`);
    };
const handleTrainTroops = async (unitId, amount) => {
    const currentState = cityGameState;
    if (!currentState || !worldId || amount <= 0) return;

    // Validate unit exists
    const unit = unitConfig[unitId];
    if (!unit) {
        setMessage("Invalid unit type");
        return;
    }

    // Check queue capacity first
    const currentQueue = currentState.unitQueue || [];
    if (currentQueue.length >= 5) {
        setMessage("Unit training queue is full (max 5).");
        return;
    }

    // Calculate costs
    const totalCost = {
        wood: unit.cost.wood * amount,
        stone: unit.cost.stone * amount,
        silver: unit.cost.silver * amount,
        population: unit.cost.population * amount,
    };

    // Check building requirements
    if (unit.type === 'naval' && (!currentState.buildings.shipyard || currentState.buildings.shipyard.level === 0)) {
        setMessage("Naval units can only be built in the Shipyard.");
        return;
    }
    if (unit.type === 'land' && (!currentState.buildings.barracks || currentState.buildings.barracks.level === 0) && !unit.mythical) {
        setMessage("Land units can only be trained in the Barracks.");
        return;
    }
    if (unit.mythical && (!currentState.buildings.divine_temple || currentState.buildings.divine_temple.level === 0)) {
        setMessage("Mythical units can only be trained in the Divine Temple.");
        return;
    }

    // Check population capacity
    let effectiveUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units);
    currentQueue.forEach(task => {
        effectiveUsedPopulation += (unitConfig[task.unitId]?.cost.population || 0) * task.amount;
    });
    const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
    const availablePopulation = maxPopulation - effectiveUsedPopulation;

    // Validate resources and population
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

    // Create new game state
    const newGameState = JSON.parse(JSON.stringify(currentState));
    newGameState.resources.wood -= totalCost.wood;
    newGameState.resources.stone -= totalCost.stone;
    newGameState.resources.silver -= totalCost.silver;

    // Calculate end time - filter out any completed tasks first
    const activeQueue = currentQueue.filter(task => {
        const taskEndTime = task.endTime?.toDate ? task.endTime.toDate() : new Date(task.endTime);
        return taskEndTime.getTime() > Date.now();
    });

    let lastEndTime = Date.now();
    if (activeQueue.length > 0) {
        const lastItem = activeQueue[activeQueue.length - 1];
        const lastItemEndTime = lastItem.endTime?.toDate ? lastItem.endTime.toDate() : new Date(lastItem.endTime);
        lastEndTime = lastItemEndTime.getTime();
    }

    // Calculate training time (instant mode takes 1 second)
    const trainingTime = isInstantUnits ? 1 : unit.cost.time * amount;
    const endTime = new Date(lastEndTime + trainingTime * 1000);

    // Add to queue
    const newQueueItem = {
        unitId,
        amount,
        endTime: endTime,
    };
    newGameState.unitQueue = [...activeQueue, newQueueItem];

    try {
        await saveGameState(newGameState);
        setCityGameState(newGameState);
        setMessage(`Training ${amount} ${unit.name}s (ready in ${formatTime(trainingTime)})`);
    } catch (error) {
        console.error("Error adding to unit queue:", error);
        setMessage("Could not start training. Please try again.");
    }
};

// Helper function to format time (HH:MM:SS)
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

    const handleHealTroops = async (unitsToHeal) => {
        const currentState = cityGameState;
        if (!currentState || !worldId || Object.keys(unitsToHeal).length === 0) return;
    
        const newGameState = JSON.parse(JSON.stringify(currentState));
        let currentQueue = newGameState.healQueue || [];
        
        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const usedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units);
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
            // #comment Check if the previous item in the queue exists before trying to get its endTime
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
        setMessage(`Healing for ${canceledTask.amount} ${unit.name}s canceled and resources refunded.`);
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

    const handleCheat = async (amounts, troop, warehouseLevels, instantBuild, unresearchId, instantResearch, instantUnits, favorAmount, foundSecondCity) => {
        if (!cityGameState || !userProfile?.is_admin) return;

        // #comment Handle founding a second city as an admin action
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
            
            // #comment Check for existing city names to avoid duplicates
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
                unitQueue: [],
                researchQueue: [],
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
        handleCheat, handlePlotClick, handleCastSpell
    };
};
