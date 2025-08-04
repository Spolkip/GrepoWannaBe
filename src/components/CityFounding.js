// src/components/CityFounding.js
import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, writeBatch, collection, query, where, limit, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import buildingConfig from '../gameData/buildings.json';

const CityFounding = ({ onCityFounded }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, worldState, setActiveCityId } = useGame();
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
        if (!cityName.trim() || !selectedSlot || !userProfile) {
            setMessage("Cannot found city: user profile not loaded yet.");
            return;
        }
        setIsLoading(true);
        setMessage('Founding your city...');

        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', selectedSlot.id);
        const newCityDocRef = doc(collection(db, `users/${currentUser.uid}/games`, worldId, 'cities'));

        try {
            const slotSnap = await getDoc(citySlotRef);
            if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                throw new Error("This location was taken. Please try again.");
            }

            const batch = writeBatch(db);

            batch.update(citySlotRef, {
                ownerId: currentUser.uid,
                ownerUsername: userProfile.username,
                cityName: cityName.trim()
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
                cityName: cityName.trim(),
                playerInfo: { religion: userProfile.religion, nation: userProfile.nation },
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

            await batch.commit();

            // #comment Immediately trigger the state update. The view change will be the confirmation of success.
            setActiveCityId(newCityDocRef.id);
            
            if (onCityFounded && typeof onCityFounded === 'function') {
                onCityFounded();
            }

        } catch (error) {
            console.error("Error founding city: ", error);
            setMessage(`Failed to found city: ${error.message}`);
            setSelectedSlot(null);
            handleSelectSlot();
            // #comment Ensure loading is false on error so the user can try again
            setIsLoading(false);
        }
        // #comment isLoading is not set to false on success, as the component should unmount.
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
