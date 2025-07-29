import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useGame } from '../../../contexts/GameContext';
import { writeBatch, doc, getDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import buildingConfig from '../../../gameData/buildings.json';

export const useAdminActions = (setMessage, invalidateChunkCache) => {
    const { userProfile } = useAuth();
    const { worldId } = useGame();
    const [isPlacingDummyCity, setIsPlacingDummyCity] = useState(false);

    const handleToggleDummyCityPlacement = () => {
        if (!userProfile?.is_admin) return;
        setIsPlacingDummyCity(prevMode => {
            setMessage(!prevMode ? 'Dummy city placement ON. Click an empty slot.' : 'Dummy city placement OFF.');
            return !prevMode;
        });
    };

    const handleCreateDummyCity = async (citySlotId, slotData) => {
        if (!userProfile?.is_admin) {
            setMessage("You are not authorized to perform this action.");
            return;
        }
        setIsPlacingDummyCity(false);
        setMessage("Creating dummy city...");

        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
        const dummyUserId = `dummy_${uuidv4()}`;
        const dummyUsername = `DummyPlayer_${Math.floor(Math.random() * 10000)}`;
        const dummyGameDocRef = doc(db, `users/${dummyUserId}/games`, worldId);

        try {
            const slotSnap = await getDoc(citySlotRef);
            if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                throw new Error("Slot is already taken.");
            }

            const batch = writeBatch(db);
            const dummyCityName = `${dummyUsername}'s Outpost`;

            batch.update(citySlotRef, {
                ownerId: dummyUserId, ownerUsername: dummyUsername, cityName: dummyCityName,
            });

            const initialBuildings = {};
            Object.keys(buildingConfig).forEach(key => { initialBuildings[key] = { level: 0 }; });
            initialBuildings.senate = { level: 1 };

            batch.set(dummyGameDocRef, {
                id: citySlotId, cityName: dummyCityName,
                playerInfo: { religion: 'Dummy', nation: 'Dummy' },
                resources: { wood: 500, stone: 500, silver: 100 },
                buildings: initialBuildings, units: { swordsman: 5 }, lastUpdated: Date.now(),
            });

            await batch.commit();
            setMessage(`Dummy city "${dummyCityName}" created successfully!`);
            invalidateChunkCache(slotData.x, slotData.y);

        } catch (error) {
            console.error("Error creating dummy city:", error);
            setMessage(`Failed to create dummy city: ${error.message}`);
        }
    };
    
    const handleRushMovement = async (movementId) => {
        if (!userProfile?.is_admin) return;
        const movementRef = doc(db, 'worlds', worldId, 'movements', movementId);
        await updateDoc(movementRef, { arrivalTime: new Date() });
    };

    return { isPlacingDummyCity, handleToggleDummyCityPlacement, handleCreateDummyCity, handleRushMovement };
};