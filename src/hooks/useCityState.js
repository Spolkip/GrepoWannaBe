import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { db } from '../firebase/config';
import buildingConfig from '../gameData/buildings.json';
import unitConfig from '../gameData/units.json';
import researchConfig from '../gameData/research.json';
import { useGame } from '../contexts/GameContext';
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique IDs

// #comment This hook now gets the active city ID from the GameContext
// #comment and uses it to listen to and update the correct city document.

const getMarketCapacity = (level) => {
    if (!level || level < 1) return 0;
    const capacity = 500 + (level - 1) * 200;
    return Math.min(2500, capacity);
};

export const useCityState = (worldId, isInstantBuild, isInstantResearch, isInstantUnits) => {
    const { currentUser } = useAuth();
    const { activeCityId } = useGame(); // #comment Get activeCityId from context
    const [cityGameState, setCityGameState] = useState(null);
    const gameStateRef = useRef(cityGameState);

    useEffect(() => {
        gameStateRef.current = cityGameState;
    }, [cityGameState]);

    const calculateHappiness = useCallback((buildings) => {
        if (!buildings || !buildings.senate) return 0;
        const baseHappiness = buildings.senate.level * 5;
        
        let workerCount = 0;
        const productionBuildings = ['timber_camp', 'quarry', 'silver_mine'];
        productionBuildings.forEach(buildingId => {
            if (buildings[buildingId] && buildings[buildingId].workers) {
                workerCount += buildings[buildingId].workers;
            }
        });

        const happinessPenalty = workerCount * 3;
        return Math.max(0, Math.min(100, baseHappiness - happinessPenalty));
    }, []);
    
    const getMaxWorkerSlots = useCallback((level) => {
        if (!level || level < 1) return 0;
        return Math.min(6, 1 + Math.floor(level / 5));
    }, []);

    const getProductionRates = useCallback((buildings) => {
        if (!buildings) return { wood: 0, stone: 0, silver: 0 };
        
        const happiness = calculateHappiness(buildings);
        const happinessBonus = happiness > 70 ? 1.10 : 1.0;

        const rates = {
            wood: Math.floor(30 * Math.pow(1.2, (buildings.timber_camp?.level || 1) - 1)),
            stone: Math.floor(30 * Math.pow(1.2, (buildings.quarry?.level || 1) - 1)),
            silver: Math.floor(15 * Math.pow(1.15, (buildings.silver_mine?.level || 1) - 1)),
        };

        if (buildings.timber_camp?.workers) rates.wood *= (1 + buildings.timber_camp.workers * 0.1);
        if (buildings.quarry?.workers) rates.stone *= (1 + buildings.quarry.workers * 0.1);
        if (buildings.silver_mine?.workers) rates.silver *= (1 + buildings.silver_mine.workers * 0.1);

        rates.wood = Math.floor(rates.wood * happinessBonus);
        rates.stone = Math.floor(rates.stone * happinessBonus);
        rates.silver = Math.floor(rates.silver * happinessBonus);

        return rates;
    }, [calculateHappiness]);

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

        const calculatedTime = Math.floor(cost.time * Math.pow(1.25, level - 1));

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

    const calculateTotalPoints = useCallback((gameState) => {
        if (!gameState) return 0;
        let points = 0;
        if (gameState.buildings) {
            for (const buildingId in gameState.buildings) {
                points += gameState.buildings[buildingId].level * 10;
            }
        }
        if (gameState.units) {
            for (const unitId in gameState.units) {
                const unit = unitConfig[unitId];
                if (unit) points += gameState.units[unitId] * (unit.cost.population || 1);
            }
        }
        if (gameState.research) {
            points += Object.keys(gameState.research).length * 50;
        }
        return Math.floor(points);
    }, []);

    const saveGameState = useCallback(async (stateToSave) => {
        if (!currentUser || !worldId || !activeCityId || !stateToSave) return;
        try {
            const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
            const dataToSave = { ...stateToSave, lastUpdated: Date.now() };

            // #comment Firestore's setDoc can handle JS Date objects directly, so no special conversion is needed.
            await setDoc(cityDocRef, dataToSave, { merge: true });
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }, [currentUser, worldId, activeCityId]);

    useEffect(() => {
        if (!currentUser || !worldId || !activeCityId) {
            setCityGameState(null);
            return;
        }
        // #comment This now listens to the specific city document based on activeCityId
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const unsubscribe = onSnapshot(cityDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // #comment Ensure all top-level properties and buildings exist to prevent crashes
                if (!data.buildings) data.buildings = {};
                for (const buildingId in buildingConfig) {
                    if (!data.buildings[buildingId]) {
                        data.buildings[buildingId] = { level: 0 };
                    }
                }

                if (!data.units) data.units = {};
                if (!data.wounded) data.wounded = {};
                if (!data.worship) data.worship = {};
                if (!data.cave) data.cave = { silver: 0 }; 
                if (!data.research) data.research = {};
                if (!data.buildQueue) data.buildQueue = [];
                // Initialize new separate queues
                if (!data.barracksQueue) data.barracksQueue = [];
                if (!data.shipyardQueue) data.shipyardQueue = [];
                if (!data.divineTempleQueue) data.divineTempleQueue = [];
                // Retain healQueue
                if (!data.healQueue) data.healQueue = [];
                
                // #comment Helper to convert Firestore Timestamps to JS Dates and assign IDs if missing
                const convertAndAssignIds = (queue) => (queue || []).map(task => ({
                    id: task.id || uuidv4(), // Assign ID if missing
                    ...task,
                    endTime: task.endTime?.toDate ? task.endTime.toDate() : task.endTime
                }));
    
                data.buildQueue = convertAndAssignIds(data.buildQueue);
                data.barracksQueue = convertAndAssignIds(data.barracksQueue);
                data.shipyardQueue = convertAndAssignIds(data.shipyardQueue);
                data.divineTempleQueue = convertAndAssignIds(data.divineTempleQueue);
                data.researchQueue = convertAndAssignIds(data.researchQueue);
                data.healQueue = convertAndAssignIds(data.healQueue);

                setCityGameState(data);
            } else {
                setCityGameState(null);
            }
        });
        return () => unsubscribe();
    }, [currentUser, worldId, activeCityId]);

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
        try {
            const currentState = gameStateRef.current;
            
            // Early exit conditions
            if (!currentUser || !worldId || !activeCityId) return;
            
            // Check if any queue has items to process
            if (!currentState?.buildQueue?.length && 
                !currentState?.barracksQueue?.length &&
                !currentState?.shipyardQueue?.length &&
                !currentState?.divineTempleQueue?.length &&
                !currentState?.researchQueue?.length && 
                !currentState?.healQueue?.length) {
                return;
            }

            const now = Date.now();
            let updates = {};
            let hasUpdates = false;

            // Helper function to process each queue type
            const processSingleQueue = (queueName, processCompleted) => {
                if (!currentState[queueName]?.length) return;

                const activeQueue = [];
                const completedTasks = [];

                currentState[queueName].forEach(task => {
                    try {
                        // Handle both Firestore Timestamp and JS Date objects
                        const endTime = task.endTime?.toDate?.() || 
                                      (task.endTime instanceof Date ? task.endTime : new Date(task.endTime));
                        
                        if (isNaN(endTime.getTime())) {
                            console.error('Invalid endTime', task);
                            return;
                        }

                        if (now >= endTime.getTime()) {
                            completedTasks.push(task);
                        } else {
                            activeQueue.push(task);
                        }
                    } catch (error) {
                        console.error('Error processing queue item:', error);
                    }
                });

                if (completedTasks.length > 0) {
                    updates[queueName] = activeQueue;
                    processCompleted(completedTasks, updates);
                    hasUpdates = true;
                }
            };

            // Process each queue type
            processSingleQueue('buildQueue', (completed, updates) => {
                updates.buildings = updates.buildings || { ...currentState.buildings };
                completed.forEach(task => {
                    if (!updates.buildings[task.buildingId]) {
                        updates.buildings[task.buildingId] = { level: 0 };
                    }
                    updates.buildings[task.buildingId].level = task.level;
                });
            });

            processSingleQueue('barracksQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            processSingleQueue('shipyardQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            processSingleQueue('divineTempleQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            processSingleQueue('researchQueue', (completed, updates) => {
                updates.research = updates.research || { ...currentState.research };
                completed.forEach(task => {
                    updates.research[task.researchId] = true;
                });
            });

            processSingleQueue('healQueue', (completed, updates) => {
                updates.units = updates.units || { ...currentState.units };
                completed.forEach(task => {
                    updates.units[task.unitId] = (updates.units[task.unitId] || 0) + task.amount;
                });
            });

            // Save updates if any
            if (hasUpdates) {
                const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
                await setDoc(cityDocRef, { 
                    ...updates, 
                    lastUpdated: serverTimestamp() // Now using the imported serverTimestamp
                }, { merge: true });
            }
        } catch (error) {
            console.error("Error in queue processing:", error);
        }
    };

    const interval = setInterval(processQueue, 1000); // Process every second
    return () => clearInterval(interval);
}, [currentUser, worldId, activeCityId]);

useEffect(() => {
    const autoSave = async () => {
        if (gameStateRef.current) {
            try {
                await saveGameState(gameStateRef.current);
            } catch (error) {
                console.error("Auto-save failed:", error);
            }
        }
    };

    const saveInterval = setInterval(autoSave, 30000); // Auto-save every 30 seconds
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
    getResearchCost,
    calculateTotalPoints, 
    calculateHappiness, 
    getMaxWorkerSlots, 
    getMarketCapacity
}
};
