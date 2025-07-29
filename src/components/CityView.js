// src/components/CityView.js
import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './shared/Modal';
import SideInfoPanel from './SideInfoPanel';
import Cityscape from './city/Cityscape';
import CityHeader from './city/CityHeader';
import ResourceBar from './city/ResourceBar';
import CityModals from './city/CityModals';
import { useCityState } from '../hooks/useCityState';
import researchConfig from '../gameData/research.json';
import unitConfig from '../gameData/units.json';

const CITYSCAPE_SIZE = 2000;

const CityView = ({ showMap, worldId }) => {
    const { currentUser, userProfile } = useAuth();
    const [isInstantBuild, setIsInstantBuild] = useState(false);

    const {
        cityGameState,
        setCityGameState,
        getUpgradeCost,
        getFarmCapacity,
        calculateUsedPopulation,
        getProductionRates,
        getWarehouseCapacity,
        saveGameState
    } = useCityState(worldId, isInstantBuild);

    const [message, setMessage] = useState('');

    // Simplified modal state management
    const [modalState, setModalState] = useState({
        selectedBuildingId: null,
        isSenateViewOpen: false,
        isBarracksMenuOpen: false,
        isShipyardMenuOpen: false,
        isTempleMenuOpen: false,
        isCaveMenuOpen: false,
        isAcademyMenuOpen: false,
        isCheatMenuOpen: false,
    });

    // FIX: Simplified and corrected modal open/close functions
    const openModal = (modalKey) => setModalState(prev => ({ ...prev, [modalKey]: true }));
    const closeModal = (modalKey) => setModalState(prev => ({ ...prev, [modalKey]: false, selectedBuildingId: null }));

    // Panning Logic (no changes here)
    const viewportRef = useRef(null);
    const cityContainerRef = useRef(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const clampPan = useCallback((newPan) => {
        if (!viewportRef.current) return { x: 0, y: 0 };
        const { clientWidth, clientHeight } = viewportRef.current;
        const minX = clientWidth - CITYSCAPE_SIZE;
        const minY = clientHeight - CITYSCAPE_SIZE;
        return {
            x: Math.max(minX, Math.min(0, newPan.x)),
            y: Math.max(minY, Math.min(0, newPan.y)),
        };
    }, []);

    useLayoutEffect(() => {
        if (!viewportRef.current) return;
        const { clientWidth, clientHeight } = viewportRef.current;
        setPan(clampPan({ x: (clientWidth - CITYSCAPE_SIZE) / 2, y: (clientHeight - CITYSCAPE_SIZE) / 2 }));
    }, [clampPan]);

    useEffect(() => {
        const container = cityContainerRef.current;
        if (container) container.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
    }, [pan]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setIsPanning(true);
    }, [pan]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isPanning) return;
            setPan(clampPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }));
        };
        const handleMouseUp = () => setIsPanning(false);
        if (isPanning) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning, startPos, clampPan]);

    // Action Handlers (no changes here)
    const handleUpgrade = async (buildingId) => {
        const currentState = cityGameState;
        if (!currentState || !worldId) return;

        const currentQueue = currentState.buildQueue || [];

        if (currentQueue.length >= 5) {
            setMessage("Build queue is full (max 5).");
            return;
        }

        const building = currentState.buildings[buildingId] || { level: 0 };

        // Determine the effective current level for queuing purposes
        // This finds the highest level currently built or already in the queue for this building type
        let effectiveCurrentLevel = building.level;
        currentQueue.forEach(task => {
            if (task.buildingId === buildingId && task.level > effectiveCurrentLevel) {
                effectiveCurrentLevel = task.level;
            }
        });
        const nextLevelToQueue = effectiveCurrentLevel + 1; // This is the level for the new queue item

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
                if (lastQueueItem.endTime) { // Ensure endTime exists before accessing properties
                    lastEndTime = lastQueueItem.endTime.toDate
                        ? lastQueueItem.endTime.toDate().getTime()
                        : new Date(lastQueueItem.endTime).getTime();
                }
            }

            const endTime = new Date(lastEndTime + cost.time * 1000);

            const newQueueItem = {
                buildingId,
                level: nextLevelToQueue, // Use the calculated next level
                endTime: endTime,
            };

            newGameState.buildQueue = [...currentQueue, newQueueItem];

            try {
                await saveGameState(newGameState);
                setCityGameState(newGameState);
            } catch (error) {
                console.error("Error adding to build queue:", error);
                setMessage("Could not start upgrade. Please try again.");
            }
        } else {
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
        if (!cityGameState || !researchConfig[researchId]) return;

        const research = researchConfig[researchId];
        const { cost, requirements } = research;

        if (requirements.academy && cityGameState.buildings.academy.level < requirements.academy) {
            setMessage(`Requires Academy Level ${requirements.academy}.`);
            return;
        }
        if (requirements.research && !cityGameState.research[requirements.research]) {
            setMessage(`Requires ${researchConfig[requirements.research].name} research first.`);
            return;
        }
        if (cityGameState.research[researchId]) {
            setMessage("Already researched.");
            return;
        }

        if (
            cityGameState.resources.wood < cost.wood ||
            cityGameState.resources.stone < cost.stone ||
            cityGameState.resources.silver < cost.silver
        ) {
            setMessage("Not enough resources to start research.");
            return;
        }

        const newGameState = { ...cityGameState };
        newGameState.resources.wood -= cost.wood;
        newGameState.resources.stone -= cost.stone;
        newGameState.resources.silver -= cost.silver;
        newGameState.research[researchId] = true;

        await saveGameState(newGameState);
        setCityGameState(newGameState);
    };

    const handleTrainTroops = async (unitId, amount) => {
        if (!cityGameState || !worldId || amount <= 0) return;
        const unit = unitConfig[unitId];
        const totalCost = {
            wood: unit.cost.wood * amount,
            stone: unit.cost.stone * amount,
            silver: unit.cost.silver * amount,
            population: unit.cost.population * amount,
        };
        const currentUsedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
        const maxPopulation = getFarmCapacity(cityGameState.buildings.farm.level);
        const availablePopulation = maxPopulation - currentUsedPopulation;

        if (unit.type === 'naval' && (!cityGameState.buildings.shipyard || cityGameState.buildings.shipyard.level === 0)) {
            setMessage("Naval units can only be built in the Shipyard.");
            return;
        }
        if (unit.type === 'land' && (!cityGameState.buildings.barracks || cityGameState.buildings.barracks.level === 0)) {
            setMessage("Land units can only be trained in the Barracks.");
            return;
        }

        if (
            cityGameState.resources.wood >= totalCost.wood &&
            cityGameState.resources.stone >= totalCost.stone &&
            cityGameState.resources.silver >= totalCost.silver &&
            availablePopulation >= totalCost.population
        ) {
            const newGameState = { ...cityGameState };
            newGameState.resources.wood -= totalCost.wood;
            newGameState.resources.stone -= totalCost.stone;
            newGameState.resources.silver -= totalCost.silver;
            if (!newGameState.units) newGameState.units = {};
            newGameState.units[unitId] = (newGameState.units[unitId] || 0) + amount;
            await saveGameState(newGameState);
            setCityGameState(newGameState);
        } else {
            setMessage(availablePopulation < totalCost.population ? 'Not enough available population!' : 'Not enough resources to train troops!');
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

    const handleCheat = async (amounts, troop, warehouseLevels, instantBuild) => {
        if (!cityGameState || !userProfile?.is_admin) return;
        setIsInstantBuild(instantBuild);
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
        await saveGameState(newGameState);
        setMessage("Admin cheat applied!");
    };

    // FIX: Updated to use the new modal functions with direct keys
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
            default: setModalState(prev => ({ ...prev, selectedBuildingId: buildingId })); break;
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

            <main className="flex-grow w-full h-full relative overflow-hidden cursor-grab" ref={viewportRef} onMouseDown={handleMouseDown}>
                <div ref={cityContainerRef} style={{ transformOrigin: '0 0' }}>
                    <Cityscape buildings={cityGameState.buildings} onBuildingClick={handlePlotClick} />
                </div>
            </main>

            <SideInfoPanel gameState={cityGameState} className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20" />

            <CityModals
                cityGameState={cityGameState}
                worldId={worldId}
                currentUser={currentUser}
                userProfile={userProfile}
                isInstantBuild={isInstantBuild}
                getUpgradeCost={getUpgradeCost}
                getFarmCapacity={getFarmCapacity}
                getWarehouseCapacity={getWarehouseCapacity}
                getProductionRates={getProductionRates}
                calculateUsedPopulation={calculateUsedPopulation}
                saveGameState={saveGameState}
                handleUpgrade={handleUpgrade}
                handleCancelBuild={handleCancelBuild}
                handleTrainTroops={handleTrainTroops}
                handleStartResearch={handleStartResearch}
                handleWorshipGod={handleWorshipGod}
                handleCheat={handleCheat}
                modalState={modalState}
                openModal={openModal}
                closeModal={closeModal}
                setMessage={setMessage}
            />
        </div>
    );
};

export default CityView;