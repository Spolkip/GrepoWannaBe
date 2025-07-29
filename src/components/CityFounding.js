import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, writeBatch, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import buildingConfig from '../gameData/buildings.json';

const CityFounding = ({ onCityFounded }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, worldState, setGameState, setPlayerCity } = useGame();
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [cityName, setCityName] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (userProfile?.username) {
            setCityName(`${userProfile.username}'s Capital`);
        }
    }, [userProfile]);

    const findEmptySlot = useCallback(async () => {
        if (!worldState?.islands || !worldId) return null;

        const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
        const q = query(citySlotsRef, where('ownerId', '==', null), limit(10));

        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const randomDoc = querySnapshot.docs[Math.floor(Math.random() * querySnapshot.docs.length)];
                return { id: randomDoc.id, ...randomDoc.data() };
            }
        } catch (error) {
            console.error("Error finding an empty slot:", error);
        }
        return null;
    }, [worldId, worldState]);

    const handleSelectSlot = useCallback(async () => {
        setIsLoading(true);
        setMessage('Finding a suitable location...');
        const slot = await findEmptySlot();
        if (slot) {
            setSelectedSlot(slot);
            setMessage(`Location found at (${slot.x}, ${slot.y}). Give your new city a name.`);
        } else {
            setMessage('Could not find an available city slot. This world might be full.');
        }
        setIsLoading(false);
    }, [findEmptySlot]);

    useEffect(() => {
        handleSelectSlot();
    }, [handleSelectSlot]);

    const handleFoundCity = async (e) => {
        e.preventDefault();
        if (!cityName.trim() || !selectedSlot) return;
        setIsLoading(true);
        setMessage('Founding your city...');

        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', selectedSlot.id);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        try {
            const slotSnap = await getDoc(citySlotRef);
            if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                throw new Error("This location was taken while you were deciding. Please try again.");
            }

            const batch = writeBatch(db);

            batch.update(citySlotRef, {
                ownerId: currentUser.uid,
                ownerUsername: userProfile.username,
                cityName: cityName.trim()
            });

            const initialBuildings = {};
            // Initialize all buildings to level 0
            for (const buildingId in buildingConfig) {
                initialBuildings[buildingId] = { level: 0 };
            }
            // Set specific initial buildings to level 1
            initialBuildings.senate = { level: 1 };
            initialBuildings.farm = { level: 1 };
            initialBuildings.warehouse = { level: 1 };
            initialBuildings.timber_camp = { level: 1 };
            initialBuildings.quarry = { level: 1 };
            initialBuildings.silver_mine = { level: 1 };
            initialBuildings.cave = { level: 1 }; // Ensure Cave is initialized at Level 1

            const newGameState = {
                id: selectedSlot.id,
                x: selectedSlot.x,
                y: selectedSlot.y,
                islandId: selectedSlot.islandId,
                cityName: cityName.trim(),
                playerInfo: { religion: userProfile.religion, nation: userProfile.nation },
                resources: { wood: 1000, stone: 1000, silver: 500, population: 100 },
                storage: buildingConfig.warehouse.storage[1], // Assuming storage is based on warehouse level 1
                buildings: initialBuildings,
                units: {},
                research: {},
                lastUpdated: Date.now(),
            };
            batch.set(gameDocRef, newGameState);

            await batch.commit();

            setMessage('Transaction successful: City placed!');
            setPlayerCity(newGameState);
            setGameState(newGameState);
            onCityFounded();

        } catch (error) {
            console.error("Error founding city: ", error);
            setMessage(`Failed to found city: ${error.message}`);
            setSelectedSlot(null);
            handleSelectSlot();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="w-full max-w-md text-center p-8 bg-gray-800 rounded-lg shadow-2xl">
                <h2 className="font-title text-4xl mb-4">Found Your First City</h2>
                <p className="text-gray-400 mb-6">{message}</p>
                {selectedSlot && (
                    <form onSubmit={handleFoundCity} className="flex flex-col gap-4">
                        <input
                            type="text"
                            value={cityName}
                            onChange={(e) => setCityName(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-center text-lg"
                            required
                        />
                        <button type="submit" disabled={isLoading} className="btn btn-confirm px-8 py-3 text-lg">
                            {isLoading ? 'Claiming Land...' : 'Found City'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CityFounding;
