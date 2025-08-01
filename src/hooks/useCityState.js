// src/hooks/useCityState.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import buildingConfig from '../gameData/buildings.json';
import unitConfig from '../gameData/units.json';
import researchConfig from '../gameData/research.json';

const getGameDocRef = (userId, worldId) => doc(db, `users/${userId}/games`, worldId);

export const useCityState = (worldId, isInstantBuild, isInstantResearch, isInstantUnits) => {
    const { currentUser } = useAuth();
    const [cityGameState, setCityGameState] = useState(null);
    const gameStateRef = useRef(cityGameState);

    useEffect(() => {
        gameStateRef.current = cityGameState;
    }, [cityGameState]);

    // #comment calculate production rates considering workers
    const getProductionRates = useCallback((buildings) => {
        if (!buildings) return { wood: 0, stone: 0, silver: 0 };
        const rates = {
            wood: Math.floor(30 * Math.pow(1.2, (buildings.timber_camp?.level || 1) - 1)),
            stone: Math.floor(30 * Math.pow(1.2, (buildings.quarry?.level || 1) - 1)),
            silver: Math.floor(15 * Math.pow(1.15, (buildings.silver_mine?.level || 1) - 1)),
        };
        if (buildings.timber_camp?.workers) {
            rates.wood *= (1 + buildings.timber_camp.workers * 0.1);
        }
        if (buildings.quarry?.workers) {
            rates.stone *= (1 + buildings.quarry.workers * 0.1);
        }
        if (buildings.silver_mine?.workers) {
            rates.silver *= (1 + buildings.silver_mine.workers * 0.1);
        }
        return rates;
    }, []);

    const getWarehouseCapacity = useCallback((level) => {
        if (!level) return 0;
        return Math.floor(1000 * Math.pow(1.5, level - 1));
    }, []);

    const getFarmCapacity = useCallback((level) => {
        if (!level) return 0;
        return Math.floor(100 * Math.pow(1.3, level - 1));
    }, []);

    const getHospitalCapacity = useCallback((level) => {
        if (!level) return 0;
        return level * 1000;
    }, []);

    const getUpgradeCost = useCallback((buildingId, level) => {
        const building = buildingConfig[buildingId];
        if (!building || level < 1) return { wood: 0, stone: 0, silver: 0, population: 0, time: 0 };
        
        const cost = building.baseCost;
        let populationCost = Math.floor(cost.population * Math.pow(1.1, level - 1));
        const initialBuildings = ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave', 'hospital'];
        if (level === 1 && initialBuildings.includes(buildingId)) {
          populationCost = 0;
        }

        const calculatedTime = Math.floor(cost.time * Math.pow(1.5, level - 1));

        return {
            wood: Math.floor(cost.wood * Math.pow(1.6, level - 1)),
            stone: Math.floor(cost.stone * Math.pow(1.6, level - 1)),
            silver: Math.floor(cost.silver * Math.pow(1.8, level - 1)),
            population: populationCost,
            time: isInstantBuild ? 1 : calculatedTime,
        };
    }, [isInstantBuild]);
    
    const getResearchCost = useCallback((researchId) => {
        const research = researchConfig[researchId];
        if (!research) return null;
        return {
            wood: research.cost.wood,
            stone: research.cost.stone,
            silver: research.cost.silver,
            time: isInstantResearch ? 1 : research.cost.time,
        };
    }, [isInstantResearch]);

    // #comment calculate used population including workers
    const calculateUsedPopulation = useCallback((buildings, units) => {
        let used = 0;
        if (buildings) {
          for (const buildingId in buildings) {
            const buildingData = buildings[buildingId];
            const startLevel = ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave', 'hospital'].includes(buildingId) ? 1 : 0;
            for (let i = startLevel; i <= buildingData.level; i++) {
              if (i > 0) {
                used += getUpgradeCost(buildingId, i).population;
              }
            }
            if (buildingData.workers) {
                used += buildingData.workers * 20;
            }
          }
        }
        if (units) {
          for (const unitId in units) {
            used += (unitConfig[unitId]?.cost.population || 0) * units[unitId];
          }
        }
        return used;
    }, [getUpgradeCost]);

    const saveGameState = useCallback(async (stateToSave) => {
        if (!currentUser || !worldId || !stateToSave) return;
        try {
            const gameDocRef = getGameDocRef(currentUser.uid, worldId);
            const dataToSave = { ...stateToSave, lastUpdated: Date.now() };
            if (dataToSave.buildQueue) {
                dataToSave.buildQueue = dataToSave.buildQueue.map(task => ({
                    ...task,
                    endTime: task.endTime.toDate ? task.endTime.toDate() : task.endTime
                }));
            }
            if (dataToSave.unitQueue) {
                dataToSave.unitQueue = dataToSave.unitQueue.map(task => ({
                    ...task,
                    endTime: task.endTime.toDate ? task.endTime.toDate() : task.endTime
                }));
            }
            if (dataToSave.researchQueue) {
                dataToSave.researchQueue = dataToSave.researchQueue.map(task => ({
                    ...task,
                    endTime: task.endTime.toDate ? task.endTime.toDate() : task.endTime
                }));
            }
            if (dataToSave.healQueue) {
                dataToSave.healQueue = dataToSave.healQueue.map(task => ({
                    ...task,
                    endTime: task.endTime.toDate ? task.endTime.toDate() : task.endTime
                }));
            }
            await setDoc(gameDocRef, dataToSave, { merge: true });
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }, [currentUser, worldId]);

    useEffect(() => {
        if (!currentUser || !worldId) return;
        const gameDocRef = getGameDocRef(currentUser.uid, worldId);
        const unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (!data.units) data.units = {};
                if (!data.wounded) data.wounded = {};
                if (!data.worship) data.worship = {};
                if (!data.cave) data.cave = { silver: 0 }; 
                if (!data.research) data.research = {};
                if (!data.buildings.cave) data.buildings.cave = { level: 1 };
                if (!data.buildings.hospital) data.buildings.hospital = { level: 0 };
                if (!data.buildQueue) data.buildQueue = [];
                if (!data.unitQueue) data.unitQueue = [];
                if (!data.researchQueue) data.researchQueue = [];
                if (!data.healQueue) data.healQueue = [];

                setCityGameState(data);
            }
        });
        return () => unsubscribe();
    }, [currentUser, worldId]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCityGameState(prevState => {
                if (!prevState) return null;
                const now = Date.now();
                const lastUpdate = prevState.lastUpdated || now;
                const elapsedSeconds = (now - lastUpdate) / 1000;
                
                const newState = JSON.parse(JSON.stringify(prevState));
                
                const productionRates = getProductionRates(newState.buildings);
                const capacity = getWarehouseCapacity(newState.buildings?.warehouse?.level);
                newState.resources.wood = Math.min(capacity, prevState.resources.wood + (productionRates.wood / 3600) * elapsedSeconds);
                newState.resources.stone = Math.min(capacity, prevState.resources.stone + (productionRates.stone / 3600) * elapsedSeconds);
                newState.resources.silver = Math.min(capacity, prevState.resources.silver + (productionRates.silver / 3600) * elapsedSeconds);

                const templeLevel = newState.buildings.temple?.level || 0;
                if (newState.god && templeLevel > 0) {
                    const favorPerSecond = templeLevel / 3600;
                    const maxFavor = 100 + (templeLevel * 20);
                    newState.worship[newState.god] = Math.min(maxFavor, (prevState.worship[newState.god] || 0) + favorPerSecond * elapsedSeconds);
                }
                
                newState.lastUpdated = now;
                return newState;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [getProductionRates, getWarehouseCapacity]);

    useEffect(() => {
        const processQueue = async () => {
            const currentState = gameStateRef.current;
            if (!currentUser || !worldId || (!currentState?.buildQueue?.length && !currentState?.unitQueue?.length && !currentState?.researchQueue?.length && !currentState?.healQueue?.length)) return;

            const now = Date.now();

            // Process Build Queue
            if (currentState.buildQueue && currentState.buildQueue.length > 0) {
                const completedBuildTasks = [];
                const remainingBuildQueue = [];

                currentState.buildQueue.forEach(task => {
                    const endTime = task.endTime?.toDate ? task.endTime.toDate().getTime() : new Date(task.endTime).getTime();
                    if (endTime > 0 && now >= endTime) {
                        completedBuildTasks.push(task);
                    } else {
                        remainingBuildQueue.push(task);
                    }
                });

                if (completedBuildTasks.length > 0) {
                    const newBuildings = { ...currentState.buildings };
                    completedBuildTasks.forEach(task => {
                        newBuildings[task.buildingId].level = task.level;
                    });
                    try {
                        await setDoc(getGameDocRef(currentUser.uid, worldId), {
                            buildings: newBuildings,
                            buildQueue: remainingBuildQueue,
                            lastUpdated: now
                        }, { merge: true });
                    } catch (error) {
                        console.error("Error completing build task(s):", error);
                    }
                }
            }

            // Process Unit Queue
            if (currentState.unitQueue && currentState.unitQueue.length > 0) {
                const completedUnitTasks = [];
                const remainingUnitQueue = [];

                currentState.unitQueue.forEach(task => {
                    const endTime = task.endTime?.toDate ? task.endTime.toDate().getTime() : new Date(task.endTime).getTime();
                    if (endTime > 0 && now >= endTime) {
                        completedUnitTasks.push(task);
                    } else {
                        remainingUnitQueue.push(task);
                    }
                });

                if (completedUnitTasks.length > 0) {
                    const newUnits = { ...currentState.units };
                    completedUnitTasks.forEach(task => {
                        newUnits[task.unitId] = (newUnits[task.unitId] || 0) + task.amount;
                    });
                    try {
                        await setDoc(getGameDocRef(currentUser.uid, worldId), {
                            units: newUnits,
                            unitQueue: remainingUnitQueue,
                            lastUpdated: now
                        }, { merge: true });
                    } catch (error) {
                        console.error("Error completing unit training task(s):", error);
                    }
                }
            }

            // Process Research Queue
            if (currentState.researchQueue && currentState.researchQueue.length > 0) {
                const completedResearchTasks = [];
                const remainingResearchQueue = [];

                currentState.researchQueue.forEach(task => {
                    const endTime = task.endTime?.toDate ? task.endTime.toDate().getTime() : new Date(task.endTime).getTime();
                    if (endTime > 0 && now >= endTime) {
                        completedResearchTasks.push(task);
                    } else {
                        remainingResearchQueue.push(task);
                    }
                });

                if (completedResearchTasks.length > 0) {
                    const newResearch = { ...currentState.research };
                    completedResearchTasks.forEach(task => {
                        newResearch[task.researchId] = true;
                    });
                    try {
                        await setDoc(getGameDocRef(currentUser.uid, worldId), {
                            research: newResearch,
                            researchQueue: remainingResearchQueue,
                            lastUpdated: now
                        }, { merge: true });
                    } catch (error) {
                        console.error("Error completing research task(s):", error);
                    }
                }
            }

            // Process Heal Queue
            if (currentState.healQueue && currentState.healQueue.length > 0) {
                const completedHealTasks = [];
                const remainingHealQueue = [];

                currentState.healQueue.forEach(task => {
                    const endTime = task.endTime?.toDate ? task.endTime.toDate().getTime() : new Date(task.endTime).getTime();
                    if (endTime > 0 && now >= endTime) {
                        completedHealTasks.push(task);
                    } else {
                        remainingHealQueue.push(task);
                    }
                });

                if (completedHealTasks.length > 0) {
                    const newUnits = { ...currentState.units };
                    completedHealTasks.forEach(task => {
                        newUnits[task.unitId] = (newUnits[task.unitId] || 0) + task.amount;
                    });
                    try {
                        await setDoc(getGameDocRef(currentUser.uid, worldId), {
                            units: newUnits,
                            healQueue: remainingHealQueue,
                            lastUpdated: now
                        }, { merge: true });
                    } catch (error) {
                        console.error("Error completing healing task(s):", error);
                    }
                }
            }
        };
        const interval = setInterval(processQueue, 1000);
        return () => clearInterval(interval);
    }, [currentUser, worldId]);

    useEffect(() => {
        const saveInterval = setInterval(() => {
            if (gameStateRef.current) saveGameState(gameStateRef.current);
        }, 30000);
        return () => clearInterval(saveInterval);
    }, [saveGameState]);

    return { 
        cityGameState, 
        setCityGameState, 
        getUpgradeCost, 
        getFarmCapacity,
        getWarehouseCapacity,
        getHospitalCapacity,
        getProductionRates,
        calculateUsedPopulation,
        saveGameState,
        getResearchCost
    };
};
