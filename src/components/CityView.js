// src/components/CityView.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './shared/Modal';
import CityHeader from './city/CityHeader';
import ResourceBar from './city/ResourceBar';
import CityModals from './city/CityModals';
import CityViewContent from './city/CityViewContent';
import DivinePowers from './city/DivinePowers'; // Import DivinePowers
import { useCityState } from '../hooks/useCityState';
import researchConfig from '../gameData/research.json';
import unitConfig from '../gameData/units.json';
import { useGame } from '../contexts/GameContext';

const CityView = ({ showMap, worldId }) => {
    const { currentUser, userProfile } = useAuth();
    const { gameSettings } = useGame();
    const [isInstantBuild, setIsInstantBuild] = useState(false);
    const [isInstantResearch, setIsInstantResearch] = useState(false);
    const [isInstantUnits, setIsInstantUnits] = useState(false);

    const {
        cityGameState,
        setCityGameState,
        getUpgradeCost,
        getFarmCapacity,
        calculateUsedPopulation,
        getProductionRates,
        getWarehouseCapacity,
        getHospitalCapacity,
        saveGameState,
        getResearchCost
    } = useCityState(worldId, isInstantBuild, isInstantResearch, isInstantUnits);

    const [message, setMessage] = useState('');

    const [modalState, setModalState] = useState({
        selectedBuildingId: null,
        isSenateViewOpen: false,
        isBarracksMenuOpen: false,
        isShipyardMenuOpen: false,
        isTempleMenuOpen: false,
        isCaveMenuOpen: false,
        isAcademyMenuOpen: false,
        isHospitalMenuOpen: false,
        isCheatMenuOpen: false,
        isDivinePowersOpen: false,
    });

    const openModal = (modalKey) => setModalState(prev => ({ ...prev, [modalKey]: true }));
    const closeModal = (modalKey) => setModalState(prev => ({ ...prev, [modalKey]: false, selectedBuildingId: null }));

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
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1].endTime.toDate ? newQueue[i - 1].endTime.toDate().getTime() : new Date(newQueue[i - 1].endTime).getTime());

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
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1].endTime.toDate ? newQueue[i - 1].endTime.toDate().getTime() : new Date(newQueue[i - 1].endTime).getTime());

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
            const previousTaskEndTime = (i === 0)
                ? Date.now()
                : (newQueue[i - 1].endTime.toDate ? newQueue[i - 1].endTime.toDate().getTime() : new Date(newQueue[i - 1].endTime).getTime());

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

        const currentQueue = currentState.unitQueue || [];

        if (currentQueue.length >= 5) {
            setMessage("Unit training queue is full (max 5).");
            return;
        }

        const unit = unitConfig[unitId];

        const totalCost = {
            wood: unit.cost.wood * amount,
            stone: unit.cost.stone * amount,
            silver: unit.cost.silver * amount,
            population: unit.cost.population * amount,
        };

        let effectiveUsedPopulation = calculateUsedPopulation(currentState.buildings, currentState.units);
        currentQueue.forEach(task => {
            effectiveUsedPopulation += (unitConfig[task.unitId]?.cost.population || 0) * task.amount;
        });

        const maxPopulation = getFarmCapacity(currentState.buildings.farm.level);
        const availablePopulation = maxPopulation - effectiveUsedPopulation;

        if (unit.type === 'naval' && (!currentState.buildings.shipyard || currentState.buildings.shipyard.level === 0)) {
            setMessage("Naval units can only be built in the Shipyard.");
            return;
        }
        if (unit.type === 'land' && (!currentState.buildings.barracks || currentState.buildings.barracks.level === 0)) {
            setMessage("Land units can only be trained in the Barracks.");
            return;
        }

        if (
            currentState.resources.wood >= totalCost.wood &&
            currentState.resources.stone >= totalCost.stone &&
            currentState.resources.silver >= totalCost.silver &&
            availablePopulation >= totalCost.population
        ) {
            const newGameState = JSON.parse(JSON.stringify(currentState));

            newGameState.resources.wood -= totalCost.wood;
            newGameState.resources.stone -= totalCost.stone;
            newGameState.resources.silver -= totalCost.silver;

            let lastEndTime = Date.now();
            if (currentQueue.length > 0) {
                const lastQueueItem = currentQueue[currentQueue.length - 1];
                if (lastQueueItem.endTime) {
                    lastEndTime = lastQueueItem.endTime.toDate
                        ? lastQueueItem.endTime.toDate().getTime()
                        : new Date(lastQueueItem.endTime).getTime();
                }
            }

            const trainingTime = unit.cost.time * amount;
            const endTime = new Date(lastEndTime + (isInstantUnits ? 1 : trainingTime) * 1000);

            const newQueueItem = {
                unitId,
                amount,
                endTime: endTime,
            };

            newGameState.unitQueue = [...currentQueue, newQueueItem];

            try {
                await saveGameState(newGameState);
                setCityGameState(newGameState);
                setMessage(`Training ${amount} ${unit.name}s.`);
            }
            catch (error) {
                console.error("Error adding to unit queue:", error);
                setMessage("Could not start training. Please try again.");
            }
        } else {
            setMessage(availablePopulation < totalCost.population ? 'Not enough available population!' : 'Not enough resources to train troops!');
        }
    };

    const handleHealTroops = async (unitsToHeal) => {
        const currentState = cityGameState;
        if (!currentState || !worldId || Object.keys(unitsToHeal).length === 0) return;

        const currentQueue = currentState.healQueue || [];
        if (currentQueue.length >= 5) {
            setMessage("Healing queue is full (max 5).");
            return;
        }

        const totalCost = { wood: 0, stone: 0, silver: 0 };
        let totalTime = 0;

        for (const unitId in unitsToHeal) {
            const amount = unitsToHeal[unitId];
            const unit = unitConfig[unitId];
            totalCost.wood += (unit.heal_cost.wood || 0) * amount;
            totalCost.stone += (unit.heal_cost.stone || 0) * amount;
            totalCost.silver += (unit.heal_cost.silver || 0) * amount;
            totalTime += (unit.heal_time || 0) * amount;
        }
        
        if (
            currentState.resources.wood >= totalCost.wood &&
            currentState.resources.stone >= totalCost.stone &&
            currentState.resources.silver >= totalCost.silver
        ) {
            const newGameState = JSON.parse(JSON.stringify(currentState));
            newGameState.resources.wood -= totalCost.wood;
            newGameState.resources.stone -= totalCost.stone;
            newGameState.resources.silver -= totalCost.silver;

            const newWounded = { ...newGameState.wounded };
            for (const unitId in unitsToHeal) {
                newWounded[unitId] -= unitsToHeal[unitId];
                if (newWounded[unitId] <= 0) {
                    delete newWounded[unitId];
                }
            }
            newGameState.wounded = newWounded;

            let lastEndTime = Date.now();
            if (currentQueue.length > 0) {
                const lastQueueItem = currentQueue[currentQueue.length - 1];
                lastEndTime = lastQueueItem.endTime.toDate ? lastQueueItem.endTime.toDate().getTime() : new Date(lastQueueItem.endTime).getTime();
            }

            const endTime = new Date(lastEndTime + totalTime * 1000);

            for (const unitId in unitsToHeal) {
                const newQueueItem = {
                    unitId,
                    amount: unitsToHeal[unitId],
                    endTime,
                };
                 newGameState.healQueue = [...newGameState.healQueue, newQueueItem];
            }

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

    const handleCheat = async (amounts, troop, warehouseLevels, instantBuild, unresearchId, instantResearch, instantUnits, favorAmount) => {
        if (!cityGameState || !userProfile?.is_admin) return;
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
            case 'cave': openModal('isCaveMenuOpen'); break;
            case 'academy': openModal('isAcademyMenuOpen'); break;
            case 'hospital': openModal('isHospitalMenuOpen'); break;
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
            // Add more spell effects here in the future
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

    if (!cityGameState) {
        return <div className="text-white text-center p-10">Loading City...</div>;
    }

    const productionRates = getProductionRates(cityGameState.buildings);
    const maxPopulation = getFarmCapacity(cityGameState.buildings?.farm?.level);
    const usedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
    const availablePopulation = maxPopulation - usedPopulation;

    return (
        <div className="w-full h-screen flex flex-col bg-gray-900">
            <Modal message={message} onClose={() => setMessage('')} />

            <CityHeader
                cityGameState={cityGameState}
                worldId={worldId}
                showMap={showMap}
                onCityNameChange={(newName) => setCityGameState(prev => ({ ...prev, cityName: newName }))}
                setMessage={setMessage}
                onOpenCheats={() => openModal('isCheatMenuOpen')}
            />

            <ResourceBar
                resources={cityGameState.resources}
                productionRates={productionRates}
                availablePopulation={availablePopulation}
            />

            <CityViewContent
                cityGameState={cityGameState}
                handlePlotClick={handlePlotClick}
                onOpenPowers={() => openModal('isDivinePowersOpen')}
                gameSettings={gameSettings}
            />

            <CityModals
                cityGameState={cityGameState}
                worldId={worldId}
                currentUser={currentUser}
                userProfile={userProfile}
                isInstantBuild={isInstantBuild}
                getUpgradeCost={getUpgradeCost}
                getFarmCapacity={getFarmCapacity}
                getWarehouseCapacity={getWarehouseCapacity}
                getHospitalCapacity={getHospitalCapacity}
                getProductionRates={getProductionRates}
                calculateUsedPopulation={calculateUsedPopulation}
                saveGameState={saveGameState}
                handleUpgrade={handleUpgrade}
                handleCancelBuild={handleCancelBuild}
                handleTrainTroops={handleTrainTroops}
                handleCancelTrain={handleCancelTrain}
                handleStartResearch={handleStartResearch}
                handleCancelResearch={handleCancelResearch}
                handleWorshipGod={handleWorshipGod}
                handleCheat={handleCheat}
                handleHealTroops={handleHealTroops}
                modalState={modalState}
                openModal={openModal}
                closeModal={closeModal}
                setMessage={setMessage}
            />
            {modalState.isDivinePowersOpen && (
                <DivinePowers
                    godName={cityGameState.god}
                    playerReligion={cityGameState.playerInfo.religion}
                    favor={cityGameState.worship[cityGameState.god] || 0}
                    onCastSpell={handleCastSpell}
                    onClose={() => closeModal('isDivinePowersOpen')}
                />
            )}
        </div>
    );
};

export default CityView;
