import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { db } from '../firebase/config';
import { collection, writeBatch, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { calculateDistance, calculateTravelTime } from '../utils/travel';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';

export const useMapActions = (openModal, closeModal, showCity, invalidateChunkCache) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState, playerCity, setGameState } = useGame();
    const [message, setMessage] = useState('');
    const [travelTimeInfo, setTravelTimeInfo] = useState(null);

    const handleActionClick = useCallback((mode, targetCity) => {
        if (['attack', 'reinforce', 'scout', 'trade'].includes(mode)) {
            openModal('action', { mode, city: targetCity });
            closeModal('city');
            closeModal('village');
        } else if (mode === 'message') {
            openModal('messages', { city: targetCity });
            closeModal('city');
        } else if (['information', 'rally'].includes(mode)) {
            setMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} is not yet implemented.`);
        }
    }, [openModal, closeModal]);

    const handleSendMovement = async (movementDetails) => {
        const { mode, targetCity, units, resources, attackFormation } = movementDetails;
        // Only restrict village interactions to same island
        if (targetCity.isVillageTarget && playerCity.islandId !== targetCity.islandId) {
            setMessage("You can only attack villages from a city on the same island.");
            return;
        }

        // Cross-island checks for land units (require transport ships)
        const isCrossIsland = playerCity.islandId !== targetCity.islandId;
        let hasLandUnits = false, hasNavalUnits = false, totalTransportCapacity = 0, totalLandUnitsToSend = 0;
        for (const unitId in units) {
            if (units[unitId] > 0) {
                const config = unitConfig[unitId];
                if (config.type === 'land') { hasLandUnits = true; totalLandUnitsToSend += units[unitId]; }
                else if (config.type === 'naval') { hasNavalUnits = true; totalTransportCapacity += (config.capacity || 0) * units[unitId]; }
            }
        }
        if (isCrossIsland && hasLandUnits && !hasNavalUnits) { setMessage("Ground troops cannot travel across the sea without transport ships."); return; }
        if (isCrossIsland && hasLandUnits && totalTransportCapacity < totalLandUnitsToSend) { setMessage(`Not enough transport ship capacity. Need ${totalLandUnitsToSend - totalTransportCapacity} more capacity.`); return; }

        const batch = writeBatch(db);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const distance = calculateDistance(playerCity, targetCity);
        const unitsBeingSent = Object.entries(units || {}).filter(([, count]) => count > 0);

        if (unitsBeingSent.length === 0 && !['trade', 'scout'].includes(mode)) {
            setMessage("No units selected for movement.");
            return;
        }

        const slowestSpeed = unitsBeingSent.length > 0
            ? Math.min(...unitsBeingSent.map(([unitId]) => unitConfig[unitId].speed))
            : 10;

        const travelSeconds = calculateTravelTime(distance, slowestSpeed);
        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);

        // --- Correct movement type and fields for village attacks ---
        let movementData;
        if (mode === 'attack' && targetCity.isVillageTarget) {
            movementData = {
                type: 'attack_village',
                targetVillageId: targetCity.id,
                originCityId: playerCity.id,
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                originOwnerUsername: userProfile.username,
                units,
                resources: resources || {},
                departureTime: serverTimestamp(),
                arrivalTime,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid],
                isVillageTarget: true,
                isCrossIsland: false, // Village attacks are always same-island
            };
        } else {
            movementData = {
                type: mode,
                originCityId: playerCity.id,
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                targetCityId: targetCity.id,
                targetOwnerId: targetCity.ownerId,
                ownerUsername: targetCity.ownerUsername,
                targetCityName: targetCity.cityName,
                units,
                resources: resources || {},
                departureTime: serverTimestamp(),
                arrivalTime,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid, targetCity.ownerId].filter(id => id),
                isVillageTarget: !!targetCity.isVillageTarget,
                isCrossIsland, // Add the flag here
            };
        }

        batch.set(newMovementRef, movementData);

        // --- THIS IS THE FIX ---
        // Prepare the updated state for units and resources
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const updatedUnits = { ...gameState.units };
        for (const unitId in units) {
            updatedUnits[unitId] = (updatedUnits[unitId] || 0) - units[unitId];
        }

        const updatedResources = { ...gameState.resources };
        const updatedCave = { ...gameState.cave };
        if (mode === 'scout') {
            if (resources && resources.silver) {
                updatedCave.silver = (updatedCave.silver || 0) - resources.silver;
            }
        } else if (resources) {
            for (const resource in resources) {
                updatedResources[resource] -= resources[resource];
            }
        }
        
        // Add the update operation to the same batch
        batch.update(gameDocRef, {
            units: updatedUnits,
            resources: updatedResources,
            cave: updatedCave
        });
        // --- END OF FIX ---


        // Optimistically update the local state for immediate UI feedback
        const newGameState = {
            ...gameState,
            units: updatedUnits,
            resources: updatedResources,
            cave: updatedCave,
        };

        try {
            await batch.commit();
            setGameState(newGameState);
            setMessage(`Movement sent to ${targetCity.cityName || targetCity.name}!`);
        } catch (error) {
            console.error("Error sending movement:", error);
            setMessage(`Failed to send movement: ${error.message}`);
        }
    };

    const handleCreateDummyCity = async (citySlotId, slotData) => {
        if (!userProfile?.is_admin) {
            setMessage("You are not authorized to perform this action.");
            return;
        }
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
                ownerId: dummyUserId,
                ownerUsername: dummyUsername,
                cityName: dummyCityName,
            });

            const initialBuildings = {};
            Object.keys(buildingConfig).forEach(key => {
                initialBuildings[key] = { level: 0 };
            });
            initialBuildings.senate = { level: 1 };

            batch.set(dummyGameDocRef, {
                id: citySlotId,
                cityName: dummyCityName,
                playerInfo: { religion: 'Dummy', nation: 'Dummy' },
                resources: { wood: 500, stone: 500, silver: 100 },
                buildings: initialBuildings,
                units: {},
                lastUpdated: Date.now(),
            });

            await batch.commit();
            setMessage(`Dummy city "${dummyCityName}" created successfully!`);

            invalidateChunkCache(slotData.x, slotData.y);

        } catch (error) {
            console.error("Error creating dummy city:", error);
            setMessage(`Failed to create dummy city: ${error.message}`);
        }
    };

    return {
        message,
        setMessage,
        travelTimeInfo,
        setTravelTimeInfo,
        handleActionClick,
        handleSendMovement,
        handleCreateDummyCity
    };
};