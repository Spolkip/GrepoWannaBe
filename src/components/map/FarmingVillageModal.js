import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import Countdown from './Countdown';
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const FarmingVillageModal = ({ village, onClose, worldId, cityId }) => {
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [isDemanding, setIsDemanding] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (village && village.lastCollected) {
            const lastCollectedTime = village.lastCollected.toDate().getTime();
            const cooldownEndTime = lastCollectedTime + village.demandCooldown * 1000;
            const remaining = Math.max(0, cooldownEndTime - Date.now());
            setCooldownRemaining(remaining);

            const interval = setInterval(() => {
                setCooldownRemaining(prev => Math.max(0, prev - 1000));
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setCooldownRemaining(0);
        }
    }, [village]);

    const handleDemand = async () => {
        if (cooldownRemaining > 0 || isDemanding) return;
        setIsDemanding(true);
        setMessage('');

        const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const cityRef = doc(db, 'worlds', worldId, 'cities', cityId);

        try {
            await runTransaction(db, async (transaction) => {
                const villageDoc = await transaction.get(villageRef);
                const cityDoc = await transaction.get(cityRef);

                if (!villageDoc.exists() || !cityDoc.exists()) {
                    throw new Error("Village or your capital city could not be found.");
                }
                
                const villageData = villageDoc.data();
                const cityData = cityDoc.data();
                
                if (villageData.lastCollected) {
                    const lastCollectedTime = villageData.lastCollected.toDate().getTime();
                    const cooldownEndTime = lastCollectedTime + villageData.demandCooldown * 1000;
                    if (Date.now() < cooldownEndTime) {
                        throw new Error('You must wait for the cooldown to finish.');
                    }
                }
                
                const newResources = { ...cityData.resources };
                for (const [resource, amount] of Object.entries(villageData.demandYield)) {
                    newResources[resource] = Math.min(cityData.storage, (newResources[resource] || 0) + amount);
                }
                
                transaction.update(cityRef, { resources: newResources });
                transaction.update(villageRef, { lastCollected: serverTimestamp() });
            });

            setMessage(`Successfully demanded resources!`);
            setTimeout(onClose, 1500);

        } catch (error) {
            console.error("Error demanding resources: ", error);
            setMessage(`Failed to demand resources: ${error.message}`);
        } finally {
            setIsDemanding(false);
        }
    };
    
    return (
        <Modal onClose={onClose} title={`Farming Village: ${village.name} (Level ${village.level})`}>
            <div className="p-4 text-white text-center">
                <p className="mb-4">Demand resources from this village. The resources will be added to your capital's warehouse.</p>
                
                <div className="bg-gray-700 p-3 rounded-lg mb-4">
                    <h4 className="font-bold text-lg">Resources to Gain:</h4>
                    <div className="flex justify-center space-x-4 mt-2 text-yellow-300">
                        <span>🪵 {village.demandYield.wood}</span>
                        <span>🪨 {village.demandYield.stone}</span>
                        <span>⚪️ {village.demandYield.silver}</span>
                    </div>
                </div>

                {village.troops && Object.keys(village.troops).length > 0 && (
                    <div className="bg-gray-700 p-3 rounded-lg mb-4">
                        {/* The title is passed here */}
                        <TroopDisplay units={village.troops} unitsData={unitsData} title="Village Troops"/>
                    </div>
                )}

                {cooldownRemaining > 0 ? (
                    <div className="text-center">
                        <p className="text-yellow-400 mb-2">Available again in:</p>
                        <div className="text-2xl font-mono">
                            <Countdown initialSeconds={Math.ceil(cooldownRemaining / 1000)} onComplete={() => setCooldownRemaining(0)} />
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={handleDemand}
                        disabled={isDemanding}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded w-full transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isDemanding ? 'Demanding...' : 'Demand Resources'}
                    </button>
                )}

                {message && <p className="text-green-400 mt-4">{message}</p>}
            </div>
        </Modal>
    );
};

export default FarmingVillageModal;