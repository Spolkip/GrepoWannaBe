// src/components/map/FarmingVillageModal.js
import React, { useState, useEffect } from 'react';
import Countdown from './Countdown';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp, onSnapshot, updateDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { resolveVillageRetaliation } from '../../utils/combat';
import resourceImage from '../../images/resources/resources.png';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const FarmingVillageModal = ({ village: initialVillage, onClose, worldId, marketCapacity }) => {
    const { currentUser, userProfile } = useAuth();
    const { gameState, setGameState } = useGame();
    const [village, setVillage] = useState(initialVillage);
    const [baseVillageData, setBaseVillageData] = useState(initialVillage);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [timeSinceCollection, setTimeSinceCollection] = useState(Infinity);
    const [activeTab, setActiveTab] = useState('demand');
    const [tradeAmount, setTradeAmount] = useState(0);

    const resourceImages = {
        wood: woodImage,
        stone: stoneImage,
        silver: silverImage,
    };

    useEffect(() => {
        if (!worldId || !village?.id || !currentUser) return;

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const unsubscribePlayerVillage = onSnapshot(playerVillageRef, (docSnap) => {
            if (docSnap.exists()) {
                setVillage(prev => ({ ...prev, ...docSnap.data() }));
            }
        });

        const baseVillageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const unsubscribeBaseVillage = onSnapshot(baseVillageRef, (docSnap) => {
            if (docSnap.exists()) {
                setBaseVillageData(docSnap.data());
            }
        });

        return () => {
            unsubscribePlayerVillage();
            unsubscribeBaseVillage();
        };
    }, [worldId, village.id, currentUser]);

    useEffect(() => {
        if (!worldId || !village?.id || !baseVillageData) return;

        const interval = setInterval(async () => {
            const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
            try {
                await runTransaction(db, async (transaction) => {
                    const villageDoc = await transaction.get(villageRef);
                    if (!villageDoc.exists()) return;
                    const villageData = villageDoc.data();
                    
                    const lastUpdated = villageData.lastUpdated?.toDate() || new Date();
                    const now = new Date();
                    const elapsedHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

                    if (elapsedHours > 0) {
                        const newResources = { ...(villageData.resources || {}) };
                        const productionRate = getVillageProductionRate(villageData.level);
                        const maxResources = getVillageMaxCapacity(villageData.level);
                        
                        Object.keys(productionRate).forEach(resource => {
                             newResources[resource] = Math.min(maxResources[resource], (newResources[resource] || 0) + productionRate[resource] * elapsedHours);
                        });

                        transaction.update(villageRef, { resources: newResources, lastUpdated: serverTimestamp() });
                    }
                });
            } catch (error) {
                console.error("Error updating village resources:", error);
            }
        }, 60000 * 5);
        
        return () => clearInterval(interval);
    }, [worldId, village.id, baseVillageData]);

    // #comment regenerate happiness over time
    useEffect(() => {
        if (village?.happiness < 100) {
            const happinessRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
            const lastUpdated = village.happinessLastUpdated?.toDate() || new Date(0);
            const now = new Date();
            const elapsedHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
            
            const happinessToRegen = elapsedHours * 2; // Regenerate 2 happiness per hour
            if (happinessToRegen > 0) {
                const newHappiness = Math.min(100, (village.happiness || 0) + happinessToRegen);
                if (newHappiness > village.happiness) {
                    updateDoc(happinessRef, {
                        happiness: newHappiness,
                        happinessLastUpdated: serverTimestamp()
                    });
                }
            }
        }
    }, [village, worldId, currentUser]);

    const getVillageProductionRate = (level) => {
        const rate = level * 100;
        return { wood: rate, stone: rate, silver: Math.floor(rate * 0.5) };
    };

    const getVillageMaxCapacity = (level) => {
        const capacity = 1000 + (level - 1) * 500;
        return { wood: capacity, stone: capacity, silver: capacity };
    };

    const demandOptions = [
        { name: '5 minutes', duration: 300, multiplier: 0.125, happinessCost: 2 },
        { name: '40 minutes', duration: 2400, multiplier: 1, happinessCost: 5 },
        { name: '2 hours', duration: 7200, multiplier: 3, happinessCost: 10 },
        { name: '4 hours', duration: 14400, multiplier: 4, happinessCost: 15 },
    ];

    useEffect(() => {
        if (village && village.lastCollected) {
            const updateTimer = () => {
                const lastCollectedTime = village.lastCollected.toDate().getTime();
                const since = Math.floor((Date.now() - lastCollectedTime) / 1000);
                setTimeSinceCollection(since);
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [village]);

    const getUpgradeCost = (level) => {
        return {
            wood: Math.floor(200 * Math.pow(1.6, level - 1)),
            stone: Math.floor(200 * Math.pow(1.6, level - 1)),
            silver: Math.floor(100 * Math.pow(1.8, level - 1)),
        };
    };

    const handleDemand = async (option) => {
        if (isProcessing || !baseVillageData) return;
        setIsProcessing(true);
        setMessage('');

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const gameDocRef = doc(db, 'users', currentUser.uid, 'games', worldId);

        try {
            await runTransaction(db, async (transaction) => {
                const playerVillageDoc = await transaction.get(playerVillageRef);
                const gameDoc = await transaction.get(gameDocRef);

                if (!playerVillageDoc.exists() || !gameDoc.exists()) throw new Error("Your village or game state not found.");

                const villageData = playerVillageDoc.data();
                const gameData = gameDoc.data();

                const lastCollectedTime = villageData.lastCollected?.toDate().getTime() || 0;
                if (Date.now() < lastCollectedTime + option.duration * 1000) {
                    throw new Error('Not enough time has passed for this demand option.');
                }

                const newResources = { ...gameData.resources };
                const warehouseCapacity = 1000 * Math.pow(1.5, gameData.buildings.warehouse.level - 1);

                const yieldAmount = {
                    wood: Math.floor((baseVillageData.demandYield.wood || 0) * option.multiplier * villageData.level),
                    stone: Math.floor((baseVillageData.demandYield.stone || 0) * option.multiplier * villageData.level),
                    silver: Math.floor((baseVillageData.demandYield.silver || 0) * option.multiplier * villageData.level),
                }

                for (const [resource, amount] of Object.entries(yieldAmount)) {
                    newResources[resource] = Math.min(warehouseCapacity, (newResources[resource] || 0) + amount);
                }

                const newHappiness = Math.max(0, (villageData.happiness || 100) - option.happinessCost);

                transaction.update(gameDocRef, { resources: newResources });
                transaction.update(playerVillageRef, { 
                    lastCollected: serverTimestamp(),
                    happiness: newHappiness,
                    happinessLastUpdated: serverTimestamp()
                });
            });

            setMessage(`Successfully demanded resources! Village happiness decreased.`);

        } catch (error) {
            setMessage(`Failed to demand resources: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePlunder = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setMessage('');

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const gameDocRef = doc(db, 'users', currentUser.uid, 'games', worldId);
        const baseVillageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const reportsRef = collection(db, 'users', currentUser.uid, 'reports');

        try {
            await runTransaction(db, async (transaction) => {
                const playerVillageDoc = await transaction.get(playerVillageRef);
                const gameDoc = await transaction.get(gameDocRef);
                const baseVillageDoc = await transaction.get(baseVillageRef);

                if (!playerVillageDoc.exists() || !gameDoc.exists() || !baseVillageDoc.exists()) {
                    throw new Error("Required data not found for plunder.");
                }

                const villageData = playerVillageDoc.data();
                const gameData = gameDoc.data();
                const baseData = baseVillageDoc.data();

                const currentHappiness = villageData.happiness || 100;
                const revoltChance = (100 - currentHappiness) / 100; // 0% at 100 happy, 100% at 0 happy

                if (Math.random() < revoltChance) {
                    // Revolt! Player loses the village and troops.
                    const retaliationLosses = resolveVillageRetaliation(gameData.units);
                    const newUnits = { ...gameData.units };
                    for(const unitId in retaliationLosses) {
                        newUnits[unitId] -= retaliationLosses[unitId];
                    }
                    
                    transaction.update(gameDocRef, { units: newUnits });
                    transaction.delete(playerVillageRef);

                    const report = {
                        type: 'attack_village',
                        title: `Revolt at ${baseData.name}!`,
                        timestamp: serverTimestamp(),
                        outcome: { attackerWon: false, message: `Your plunder attempt failed and the village revolted! You have lost control and suffered casualties.` },
                        attacker: { cityName: gameData.cityName, units: {}, losses: retaliationLosses },
                        defender: { villageName: baseData.name },
                        read: false,
                    };
                    transaction.set(doc(reportsRef), report);
                    throw new Error("The village revolted! You lost control.");
                } else {
                    // Plunder successful
                    const plunderAmount = {
                        wood: Math.floor((baseData.resources.wood || 0) * 0.5),
                        stone: Math.floor((baseData.resources.stone || 0) * 0.5),
                        silver: Math.floor((baseData.resources.silver || 0) * 0.5),
                    };

                    const newPlayerResources = { ...gameData.resources };
                    const newVillageResources = { ...baseData.resources };
                    const warehouseCapacity = 1000 * Math.pow(1.5, gameData.buildings.warehouse.level - 1);

                    for(const res in plunderAmount) {
                        newPlayerResources[res] = Math.min(warehouseCapacity, newPlayerResources[res] + plunderAmount[res]);
                        newVillageResources[res] -= plunderAmount[res];
                    }
                    
                    const newHappiness = Math.max(0, currentHappiness - 40);

                    transaction.update(gameDocRef, { resources: newPlayerResources });
                    transaction.update(baseVillageRef, { resources: newVillageResources });
                    transaction.update(playerVillageRef, { happiness: newHappiness, happinessLastUpdated: serverTimestamp() });
                    
                    const report = {
                        type: 'attack_village',
                        title: `Plunder of ${baseData.name} successful!`,
                        timestamp: serverTimestamp(),
                        outcome: { attackerWon: true, plunder: plunderAmount },
                        attacker: { cityName: gameData.cityName },
                        defender: { villageName: baseData.name },
                        read: false,
                    };
                    transaction.set(doc(reportsRef), report);
                }
            });
            setMessage("Plunder successful! Resources have been seized.");
        } catch (error) {
            setMessage(`Plunder failed: ${error.message}`);
            if (error.message.includes("revolted")) {
                onClose(); // Close modal if village is lost
            }
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleUpgrade = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setMessage('');

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const gameDocRef = doc(db, 'users', currentUser.uid, 'games', worldId);
        const nextLevel = village.level + 1;
        const cost = getUpgradeCost(nextLevel);

        try {
            const newGameState = await runTransaction(db, async (transaction) => {
                const playerVillageDoc = await transaction.get(playerVillageRef);
                const gameDoc = await transaction.get(gameDocRef);

                if (!playerVillageDoc.exists() || !gameDoc.exists()) {
                    throw new Error("Your village or game state could not be found.");
                }

                const gameData = gameDoc.data();
                if (gameData.resources.wood < cost.wood || gameData.resources.stone < cost.stone || gameData.resources.silver < cost.silver) {
                    throw new Error("Not enough resources in your city to upgrade the village.");
                }

                const newResources = {
                    wood: gameData.resources.wood - cost.wood,
                    stone: gameData.resources.stone - cost.stone,
                    silver: gameData.resources.silver - cost.silver,
                };

                transaction.update(gameDocRef, { resources: newResources });
                transaction.update(playerVillageRef, { level: nextLevel });

                return { ...gameData, resources: newResources };
            });

            setGameState(newGameState);
            setMessage(`Successfully upgraded village to level ${nextLevel}!`);

        } catch (error) {
            console.error("Error upgrading village: ", error);
            setMessage(`Failed to upgrade village: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTrade = async () => {
        if (isProcessing || !baseVillageData || tradeAmount <= 0) return;
        if (tradeAmount > marketCapacity) {
            setMessage(`Trade amount cannot exceed your market capacity of ${marketCapacity}.`);
            return;
        }
        setIsProcessing(true);
        setMessage('');
    
        const gameDocRef = doc(db, 'users', currentUser.uid, 'games', worldId);
        const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
    
        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameDocRef);
                const villageDoc = await transaction.get(villageRef);
    
                if (!gameDoc.exists() || !villageDoc.exists()) throw new Error("Game state or village data not found.");
    
                const gameData = gameDoc.data();
                const villageData = villageDoc.data();
    
                const resourceToGive = villageData.demands;
                const resourceToGet = villageData.supplies;
                const amountToGet = Math.floor(tradeAmount / villageData.tradeRatio);
    
                if (gameData.resources[resourceToGive] < tradeAmount) {
                    throw new Error(`Not enough ${resourceToGive} to trade.`);
                }
                if (villageData.resources[resourceToGet] < amountToGet) {
                    throw new Error(`The village does not have enough ${resourceToGet} to trade.`);
                }
    
                const newPlayerResources = { ...gameData.resources };
                newPlayerResources[resourceToGive] -= tradeAmount;
                newPlayerResources[resourceToGet] += amountToGet;
    
                const newVillageResources = { ...villageData.resources };
                newVillageResources[resourceToGive] += tradeAmount;
                newVillageResources[resourceToGet] -= amountToGet;
    
                transaction.update(gameDocRef, { resources: newPlayerResources });
                transaction.update(villageRef, { resources: newVillageResources });
            });
    
            setMessage(`Successfully traded ${tradeAmount} ${baseVillageData.demands} for ${Math.floor(tradeAmount / baseVillageData.tradeRatio)} ${baseVillageData.supplies}.`);
            setTradeAmount(0);
        } catch (error) {
            setMessage(`Trade failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const cost = getUpgradeCost(village.level + 1);
    const canAffordUpgrade = gameState && gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone && gameState.resources.silver >= cost.silver;

    const maxTradeAmount = baseVillageData && gameState ? Math.min(gameState.resources[baseVillageData.demands] || 0, Math.floor((baseVillageData.resources?.[baseVillageData.supplies] || 0) * (baseVillageData.tradeRatio || 0)), marketCapacity || 0) : 0;
    
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl text-center border border-gray-600 pointer-events-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-yellow-400">{`Farming Village: ${baseVillageData?.name || village.name} (Level ${village.level})`}</h2>
                    <h3 className="text-xl font-semibold text-white">Happiness: <span className="text-green-400">{Math.floor(village.happiness || 100)}%</span></h3>
                </div>
                <div className="flex border-b border-gray-600 my-4">
                    <button onClick={() => setActiveTab('demand')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'demand' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Demand</button>
                    <button onClick={() => setActiveTab('plunder')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'plunder' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Plunder</button>
                    <button onClick={() => setActiveTab('trade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'trade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Trade</button>
                    <button onClick={() => setActiveTab('upgrade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'upgrade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Upgrade</button>
                </div>
                <div className="p-4 text-white">
                    {activeTab === 'demand' && (
                        <div>
                            {/* ... existing demand JSX */}
                        </div>
                    )}
                    {activeTab === 'plunder' && (
                        <div>
                            <h4 className="font-bold text-lg text-center mb-2 text-red-400">Plunder Village</h4>
                            <p className="text-center text-gray-400 text-sm mb-4">
                                Forcefully take resources from the village. This action is much faster and yields more than demanding, but it will significantly lower happiness and risks a revolt.
                            </p>
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <p className="mb-2">Current Happiness: <span className="font-bold text-green-400">{Math.floor(village.happiness || 100)}%</span></p>
                                <p className="text-xs text-gray-500 mb-4">The lower the happiness, the higher the chance the village will revolt, causing you to lose it and some of your troops.</p>
                                <button
                                    onClick={handlePlunder}
                                    disabled={isProcessing}
                                    className="btn btn-danger w-full text-lg py-2"
                                >
                                    {isProcessing ? 'Plundering...' : 'Launch Plunder Raid (-40 Happiness)'}
                                </button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'trade' && (
                         <div>
                            {/* ... existing trade JSX */}
                         </div>
                    )}
                     {activeTab === 'upgrade' && (
                        <div>
                           {/* ... existing upgrade JSX */}
                        </div>
                    )}
                    {message && <p className="text-green-400 mt-4 text-center">{message}</p>}
                </div>
                 <button
                    onClick={onClose}
                    className="btn btn-primary px-6 py-2 mt-4"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default FarmingVillageModal;