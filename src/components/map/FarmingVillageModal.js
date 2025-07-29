import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import Countdown from './Countdown';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const FarmingVillageModal = ({ village, onClose, worldId }) => {
    const { currentUser } = useAuth();
    const { gameState, setGameState } = useGame();
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [timeSinceCollection, setTimeSinceCollection] = useState(Infinity);

    const demandOptions = [
        { name: '5 minutes', duration: 300, multiplier: 0.125 },
        { name: '40 minutes', duration: 2400, multiplier: 1 },
        { name: '2 hours', duration: 7200, multiplier: 3 },
        { name: '4 hours', duration: 14400, multiplier: 6 },
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
        if (isProcessing) return;
        setIsProcessing(true);
        setMessage('');

        const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const gameDocRef = doc(db, 'users', currentUser.uid, 'games', worldId);

        try {
            await runTransaction(db, async (transaction) => {
                const villageDoc = await transaction.get(villageRef);
                const gameDoc = await transaction.get(gameDocRef);

                if (!villageDoc.exists() || !gameDoc.exists()) throw new Error("Village or game state not found.");
                
                const villageData = villageDoc.data();
                const gameData = gameDoc.data();
                
                const lastCollectedTime = villageData.lastCollected?.toDate().getTime() || 0;
                if (Date.now() < lastCollectedTime + option.duration * 1000) {
                    throw new Error('Not enough time has passed for this demand option.');
                }
                
                const newResources = { ...gameData.resources };
                const warehouseCapacity = 1000 * Math.pow(1.5, gameData.buildings.warehouse.level - 1);
                
                const yieldAmount = {
                    wood: Math.floor((villageData.demandYield.wood || 0) * option.multiplier),
                    stone: Math.floor((villageData.demandYield.stone || 0) * option.multiplier),
                    silver: Math.floor((villageData.demandYield.silver || 0) * option.multiplier),
                }

                for (const [resource, amount] of Object.entries(yieldAmount)) {
                    newResources[resource] = Math.min(warehouseCapacity, (newResources[resource] || 0) + amount);
                }
                
                transaction.update(gameDocRef, { resources: newResources });
                transaction.update(villageRef, { lastCollected: serverTimestamp() });
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

        const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const gameDocRef = doc(db, 'users', currentUser.uid, 'games', worldId);
        const nextLevel = village.level + 1;
        const cost = getUpgradeCost(nextLevel);

        try {
            const newGameState = await runTransaction(db, async (transaction) => {
                const villageDoc = await transaction.get(villageRef);
                const gameDoc = await transaction.get(gameDocRef);

                if (!villageDoc.exists() || !gameDoc.exists()) {
                    throw new Error("Village or your game state could not be found.");
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
                
                const newDemandYield = {
                    wood: nextLevel * 50,
                    stone: nextLevel * 50,
                    silver: nextLevel * 20,
                };

                transaction.update(gameDocRef, { resources: newResources });
                transaction.update(villageRef, { level: nextLevel, demandYield: newDemandYield });
                
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
    
    const cost = getUpgradeCost(village.level + 1);
    const canAffordUpgrade = gameState && gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone && gameState.resources.silver >= cost.silver;

    return (
        <Modal onClose={onClose} title={`Farming Village: ${village.name} (Level ${village.level})`}>
            <div className="p-4 text-white">
                <div className="mb-6">
                    <h4 className="font-bold text-lg text-center mb-2">Demand Resources</h4>
                    <p className="text-center text-gray-400 text-sm mb-4">Choose an option to demand resources. Shorter times yield fewer resources.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {demandOptions.map(option => {
                            const isAvailable = timeSinceCollection >= option.duration;
                            const currentYield = {
                                wood: Math.floor((village.demandYield?.wood || 0) * option.multiplier),
                                stone: Math.floor((village.demandYield?.stone || 0) * option.multiplier),
                                silver: Math.floor((village.demandYield?.silver || 0) * option.multiplier)
                            };
                            return (
                                <div key={option.name} className="bg-gray-900 border border-gray-700 p-2 rounded-lg text-center flex flex-col justify-between shadow-md">
                                    <div className="relative h-16 mb-2 flex justify-center items-center">
                                        <img src={woodImage} alt="wood" className="w-8 h-8 absolute top-0 left-2 transform -rotate-15"/>
                                        <img src={stoneImage} alt="stone" className="w-10 h-10 absolute bottom-0"/>
                                        <img src={silverImage} alt="silver" className="w-8 h-8 absolute top-0 right-2 transform rotate-15"/>
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

                <hr className="border-gray-600 my-4" />

                <div className="mb-2">
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
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded w-full transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Processing...' : 'Upgrade Village'}
                    </button>
                </div>
                {message && <p className="text-green-400 mt-4 text-center">{message}</p>}
            </div>
        </Modal>
    );
};

export default FarmingVillageModal;