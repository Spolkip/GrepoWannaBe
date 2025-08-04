// src/hooks/useMapActions.js
import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { db } from '../firebase/config';
import { collection, writeBatch, doc, serverTimestamp, getDoc, runTransaction, query, where, limit, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { calculateDistance, calculateTravelTime } from '../utils/travel';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';

export const useMapActions = (openModal, closeModal, showCity, invalidateChunkCache) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState, playerCity, setGameState, worldState } = useGame();
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
        } else if (mode === 'castSpell') {
            openModal('divinePowers', { targetCity });
            closeModal('city');
        } else if (mode === 'profile') {
            openModal('profile', { userId: targetCity.ownerId });
            closeModal('city');
        } else if (['information', 'rally'].includes(mode)) {
            setMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} is not yet implemented.`);
        }
    }, [openModal, closeModal]);

    const handleSendMovement = useCallback(async (movementDetails) => {
        const { mode, targetCity, units, resources, attackFormation } = movementDetails;

        if (!playerCity) {
            setMessage("Cannot send movement: Your city data could not be found.");
            return;
        }

        if (targetCity.isVillageTarget && playerCity.islandId !== targetCity.islandId) {
            setMessage("You can only attack villages from a city on the same island.");
            return;
        }

        const isCrossIsland = targetCity.isRuinTarget ? true : playerCity.islandId !== targetCity.islandId;

        let hasLandUnits = false, hasNavalUnits = false, hasFlyingUnits = false, totalTransportCapacity = 0, totalLandUnitsToSend = 0;
        for (const unitId in units) {
            if (units[unitId] > 0) {
                const config = unitConfig[unitId];
                if (config.type === 'land') { 
                    hasLandUnits = true; 
                    totalLandUnitsToSend += units[unitId];
                    if (config.flying) {
                        hasFlyingUnits = true;
                    }
                }
                else if (config.type === 'naval') { hasNavalUnits = true; totalTransportCapacity += (config.capacity || 0) * units[unitId]; }
            }
        }
        if (isCrossIsland && hasLandUnits && !hasNavalUnits && !hasFlyingUnits) { setMessage("Ground troops cannot travel across the sea without transport ships."); return; }
        if (isCrossIsland && hasLandUnits && totalTransportCapacity < totalLandUnitsToSend && !hasFlyingUnits) { setMessage(`Not enough transport ship capacity. Need ${totalLandUnitsToSend - totalTransportCapacity} more capacity.`); return; }

        const unitTypes = [];
        if (hasLandUnits) unitTypes.push('land');
        if (hasNavalUnits) unitTypes.push('naval');
        if (hasFlyingUnits) unitTypes.push('flying');

        const batch = writeBatch(db);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));

        // --- NEW LOGIC: Find target city's document ID ---
        let targetCityDocId = null;
        if (!targetCity.isVillageTarget && !targetCity.isRuinTarget && targetCity.ownerId) {
            const citiesRef = collection(db, `users/${targetCity.ownerId}/games`, worldId, 'cities');
            const q = query(citiesRef, where('slotId', '==', targetCity.id), limit(1));
            try {
                const cityQuerySnap = await getDocs(q);
                if (cityQuerySnap.empty) {
                    setMessage("Error: Could not find the target city's data. It may have been conquered or deleted.");
                    return;
                }
                targetCityDocId = cityQuerySnap.docs[0].id;
            } catch (error) {
                console.error("Error fetching target city doc ID:", error);
                setMessage("An error occurred while trying to target the city.");
                return;
            }
        }

        const distance = calculateDistance(playerCity, targetCity);
        const unitsBeingSent = Object.entries(units || {}).filter(([, count]) => count > 0);

        if (unitsBeingSent.length === 0 && !['trade', 'scout'].includes(mode)) {
            setMessage("No units selected for movement.");
            return;
        }

        const slowestSpeed = unitsBeingSent.length > 0
            ? Math.min(...unitsBeingSent.map(([unitId]) => unitConfig[unitId].speed))
            : 10; // Fallback speed

        const travelSeconds = calculateTravelTime(distance, slowestSpeed, mode, worldState, unitTypes);
        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);
        const cancellableUntil = new Date(Date.now() + 30 * 1000); // 30 seconds to cancel

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
                cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid],
                isVillageTarget: true,
                isCrossIsland: false,
            };
        } else if (mode === 'attack' && targetCity.isRuinTarget) {
            movementData = {
                type: 'attack_ruin',
                targetRuinId: targetCity.id,
                originCityId: playerCity.id,
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                originOwnerUsername: userProfile.username,
                units,
                departureTime: serverTimestamp(),
                arrivalTime,
                cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid],
                isRuinTarget: true,
                isCrossIsland: true,
            };
        } else {
            movementData = {
                type: mode,
                originCityId: playerCity.id,
                originOwnerId: currentUser.uid,
                originCityName: playerCity.cityName,
                targetCityId: targetCityDocId, // Use the actual document ID
                targetSlotId: targetCity.id, // Keep the slot ID for indicators
                targetOwnerId: targetCity.ownerId,
                ownerUsername: targetCity.ownerUsername,
                targetCityName: targetCity.cityName,
                units,
                resources: resources || {},
                departureTime: serverTimestamp(),
                arrivalTime,
                cancellableUntil,
                status: 'moving',
                attackFormation: attackFormation || {},
                involvedParties: [currentUser.uid, targetCity.ownerId].filter(id => id),
                isVillageTarget: !!targetCity.isVillageTarget,
                isCrossIsland,
            };
        }

        batch.set(newMovementRef, movementData);

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', playerCity.id);
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
        
        batch.update(gameDocRef, {
            units: updatedUnits,
            resources: updatedResources,
            cave: updatedCave
        });

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
    }, [currentUser, userProfile, worldId, gameState, playerCity, setGameState, setMessage, worldState]);
    
    const handleCancelMovement = useCallback(async (movementId) => {
        const movementRef = doc(db, 'worlds', worldId, 'movements', movementId);
    
        try {
            await runTransaction(db, async (transaction) => {
                const movementDoc = await transaction.get(movementRef);
    
                if (!movementDoc.exists()) {
                    throw new Error("Movement data not found.");
                }
    
                const movementData = movementDoc.data();
                
                const cancellableUntil = movementData.cancellableUntil.toDate();
                if (new Date() > cancellableUntil) {
                    throw new Error("The grace period to cancel this movement has passed.");
                }
    
                const now = Date.now();
                const departureTime = movementData.departureTime.toDate().getTime();
                const elapsedTime = now - departureTime;
                const returnArrivalTime = new Date(now + elapsedTime);
    
                transaction.update(movementRef, {
                    status: 'returning',
                    arrivalTime: returnArrivalTime,
                    departureTime: serverTimestamp(),
                    cancellableUntil: new Date(0)
                });
            });
            setMessage("Movement is now returning.");
        } catch (error) {
            console.error("Error cancelling movement:", error);
            setMessage(`Could not cancel movement: ${error.message}`);
        }
    }, [worldId, setMessage]);

    const handleCreateDummyCity = useCallback(async (citySlotId, slotData) => {
        if (!userProfile?.is_admin) {
            setMessage("You are not authorized to perform this action.");
            return;
        }
        setMessage("Creating dummy city...");

        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
        const dummyUserId = `dummy_${uuidv4()}`;
        const dummyUsername = `DummyPlayer_${Math.floor(Math.random() * 10000)}`;
        const newCityDocRef = doc(collection(db, `users/${dummyUserId}/games`, worldId, 'cities'));

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

            const newCityData = {
                id: newCityDocRef.id,
                slotId: citySlotId,
                cityName: dummyCityName,
                playerInfo: { religion: 'Dummy', nation: 'Dummy' },
                resources: { wood: 500, stone: 500, silver: 100 },
                buildings: initialBuildings,
                units: { swordsman: 10 },
                lastUpdated: Date.now(),
            };
            batch.set(newCityDocRef, newCityData);

            await batch.commit();
            setMessage(`Dummy city "${dummyCityName}" created successfully!`);

            invalidateChunkCache(slotData.x, slotData.y);

        } catch (error) {
            console.error("Error creating dummy city:", error);
            setMessage(`Failed to create dummy city: ${error.message}`);
        }
    }, [userProfile, worldId, invalidateChunkCache, setMessage]);

    return {
        message,
        setMessage,
        travelTimeInfo,
        setTravelTimeInfo,
        handleActionClick,
        handleSendMovement,
        handleCancelMovement,
        handleCreateDummyCity
    };
};
