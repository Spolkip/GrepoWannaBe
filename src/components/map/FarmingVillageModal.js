import React, { useState, useEffect } from 'react';
import Countdown from './Countdown';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp, onSnapshot} from 'firebase/firestore'; // Added getDoc
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import resourceImage from '../../images/resources/resources.png';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const FarmingVillageModal = ({ village: initialVillage, onClose, worldId, marketCapacity }) => {
    const { currentUser } = useAuth();
    const { gameState, setGameState } = useGame();
    const [village, setVillage] = useState(initialVillage);
    const [baseVillageData, setBaseVillageData] = useState(initialVillage); // Initialize with prop to prevent loading bug
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

    // Listen for real-time updates on BOTH player's conquered village and the base village data
    useEffect(() => {
        if (!worldId || !village?.id || !currentUser) return;

        // Listener for player-specific data
        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const unsubscribePlayerVillage = onSnapshot(playerVillageRef, (docSnap) => {
            if (docSnap.exists()) {
                // Merge player-specific updates into the main village state
                setVillage(prev => ({ ...prev, ...docSnap.data() }));
            }
        });

        // Listener for base village data (for real-time resource updates)
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

    // #comment New useEffect for hourly resource generation
    useEffect(() => {
        if (!worldId || !village?.id || !baseVillageData) return;

        const interval = setInterval(async () => {
            const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);

            try {
                await runTransaction(db, async (transaction) => {
                    const villageDoc = await transaction.get(villageRef);
                    if (!villageDoc.exists()) throw new Error("Village not found.");
                    const villageData = villageDoc.data();
                    
                    const lastUpdated = villageData.lastUpdated?.toDate() || new Date();
                    const now = new Date();
                    const elapsedHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

                    if (elapsedHours >= 1) {
                        const newResources = { ...villageData.resources };
                        const productionRate = getVillageProductionRate(villageData.level);
                        const maxResources = getVillageMaxCapacity(villageData.level);
                        
                        Object.keys(newResources).forEach(resource => {
                             newResources[resource] = Math.min(maxResources[resource], (newResources[resource] || 0) + productionRate[resource] * elapsedHours);
                        });

                        transaction.update(villageRef, { resources: newResources, lastUpdated: serverTimestamp() });
                    }
                });
            } catch (error) {
                console.error("Error updating village resources:", error);
            }
        }, 60000); // Check every minute
        
        return () => clearInterval(interval);
    }, [worldId, village, baseVillageData]);
    
    // #comment Calculates the hourly production rate for a village based on its level.
    const getVillageProductionRate = (level) => {
        const rate = level * 100;
        return {
            wood: rate,
            stone: rate,
            silver: Math.floor(rate * 0.5)
        };
    };

    // #comment Calculates the maximum resource capacity for a village based on its level.
    const getVillageMaxCapacity = (level) => {
        const capacity = 1000 + (level - 1) * 500;
        return {
            wood: capacity,
            stone: capacity,
            silver: capacity
        };
    };

    const demandOptions = [
        { name: '5 minutes', duration: 300, multiplier: 0.125 },
        { name: '40 minutes', duration: 2400, multiplier: 1 },
        { name: '2 hours', duration: 7200, multiplier: 3 },
        { name: '4 hours', duration: 14400, multiplier: 4 },
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

                transaction.update(gameDocRef, { resources: newResources });
                transaction.update(playerVillageRef, { lastCollected: serverTimestamp() });
            });

            setMessage(`Successfully demanded resources!`);

        } catch (error) {
            setMessage(`Failed to demand resources: ${error.message}`);
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

    // fix: Ensure all values are numbers to avoid NaN
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
                <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">{`Farming Village: ${baseVillageData?.name || village.name} (Level ${village.level})`}</h2>
                <div className="flex border-b border-gray-600 mb-4">
                    <button onClick={() => setActiveTab('demand')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'demand' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Demand</button>
                    <button onClick={() => setActiveTab('trade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'trade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Trade</button>
                    <button onClick={() => setActiveTab('upgrade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'upgrade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Upgrade</button>
                </div>
                <div className="p-4 text-white">
                    {activeTab === 'demand' && (
                        <div>
                            <h4 className="font-bold text-lg text-center mb-2">Demand Resources</h4>
                            <p className="text-center text-gray-400 text-sm mb-4">Choose an option to demand resources. Shorter times yield fewer resources.</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {demandOptions.map(option => {
                                    const isAvailable = timeSinceCollection >= option.duration;
                                    const currentYield = {
                                        wood: baseVillageData ? Math.floor((baseVillageData.demandYield?.wood || 0) * option.multiplier * village.level) : 0,
                                        stone: baseVillageData ? Math.floor((baseVillageData.demandYield?.stone || 0) * option.multiplier * village.level) : 0,
                                        silver: baseVillageData ? Math.floor((baseVillageData.demandYield?.silver || 0) * option.multiplier * village.level) : 0
                                    };
                                    return (
                                        <div key={option.name} className="bg-gray-900 border border-gray-700 p-2 rounded-lg text-center flex flex-col justify-between shadow-md">
                                            <div className="relative h-16 mb-2 flex justify-center items-center">
                                                <img src={resourceImage} alt="resources" className="w-16 h-16"/>
                                            </div>
                                            <div className="text-xs space-y-1 mb-2 text-left">
                                                <p className="flex justify-between px-1"><span>Wood:</span> <span className="font-bold text-yellow-300">{currentYield.wood}</span></p>
                                                <p className="flex justify-between px-1"><span>Stone:</span> <span className="font-bold text-gray-300">{currentYield.stone}</span></p>
                                                <p className="flex justify-between px-1"><span>Silver:</span> <span className="font-bold text-blue-300">{currentYield.silver}</span></p>
                                            </div>
                                            <div className="mt-auto">
                                                {isAvailable ? (
                                                    <button
                                                        onClick={() => handleDemand(option)}
                                                        disabled={isProcessing}
                                                        className="btn btn-confirm w-full text-sm py-1"
                                                    >
                                                        Demand ({option.name})
                                                    </button>
                                                ) : (
                                                    <div className="text-center text-sm py-1 px-2 bg-gray-800 rounded">
                                                        <div className="font-mono text-red-400">
                                                            <Countdown arrivalTime={{ toDate: () => new Date(village.lastCollected.toDate().getTime() + option.duration * 1000) }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {activeTab === 'trade' && (
                         <div>
                            <h4 className="font-bold text-lg text-center mb-2">Trade with Village</h4>
                            {baseVillageData ? (
                                <>
                                    <div className="flex justify-center items-center space-x-4 my-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm text-gray-400 capitalize">You Give</span>
                                            <img src={resourceImages[baseVillageData.demands]} alt={baseVillageData.demands} className="w-12 h-12" />
                                        </div>
                                        <span className="text-3xl text-gray-400 font-bold">&rarr;</span>
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm text-gray-400 capitalize">You Receive</span>
                                            <img src={resourceImages[baseVillageData.supplies]} alt={baseVillageData.supplies} className="w-12 h-12" />
                                        </div>
                                    </div>
                                    <p className="text-center text-gray-400 text-sm mb-4">
                                        Trade Ratio: {baseVillageData.tradeRatio}:1 | Your Market Capacity: {marketCapacity}
                                        <span className="block mt-2 text-xs text-red-400 italic">
                                            (Trade amount is also limited by the village's current supplies)
                                        </span>
                                    </p>
                                    <div className="bg-gray-700 p-4 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="capitalize">Your {baseVillageData.demands}: {Math.floor(gameState.resources[baseVillageData.demands] || 0)}</span>
                                            <span className="capitalize">Village's {baseVillageData.supplies}: {Math.floor(baseVillageData.resources[baseVillageData.supplies] || 0)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max={maxTradeAmount || 0}
                                            value={tradeAmount}
                                            onChange={(e) => setTradeAmount(Number(e.target.value))}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="capitalize">You give: <span className="font-bold text-red-400">{tradeAmount} {baseVillageData.demands}</span></span>
                                            <span className="capitalize">You receive: <span className="font-bold text-green-400">{Math.floor(tradeAmount / baseVillageData.tradeRatio)} {baseVillageData.supplies}</span></span>
                                        </div>
                                        <button
                                            onClick={handleTrade}
                                            disabled={isProcessing || tradeAmount <= 0 || maxTradeAmount <= 0}
                                            className="btn btn-confirm w-full mt-4 py-2"
                                        >
                                            Trade
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-center text-gray-400 p-8">Loading trade information...</p>
                            )}
                        </div>
                    )}
                     {activeTab === 'upgrade' && (
                        <div>
                            <p className="mb-4 text-center">Invest resources to upgrade this village for better yields.</p>
                            <div className="bg-gray-700 p-3 rounded-lg mb-4">
                                <h4 className="font-bold text-lg">Cost to Upgrade to Level {village.level + 1}:</h4>
                                <div className="flex justify-center space-x-4 mt-2 text-yellow-300">
                                    <span>🪵 {cost.wood}</span>
                                    <span>🪨 {cost.stone}</span>
                                    <span>⚪️ {cost.silver}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleUpgrade}
                                disabled={isProcessing || !canAffordUpgrade}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded w-40 transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? 'Processing...' : 'Upgrade Village'}
                            </button>
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