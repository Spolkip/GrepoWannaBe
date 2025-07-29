import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { calculateDistance, calculateTravelTime } from '../../../utils/travel';
import unitConfig from '../../../gameData/units.json';

export const useMapActions = (setMessage) => {
    const { worldId, playerCity, gameState, setGameState } = useGame();
    const { currentUser } = useAuth();

    const handleSendMovement = async (movementDetails) => {
        const { mode, targetCity, units, ships, resources, attackFormation } = movementDetails;

        if (!playerCity || !worldId || !currentUser) return;

        const isDifferentIsland = targetCity.islandId !== playerCity.islandId;
        
        if (isDifferentIsland && (!ships || Object.values(ships).reduce((a, b) => a + b, 0) === 0)) {
            setMessage("You must send ships to reach another island.");
            return false;
        }

        const batch = writeBatch(db);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const distance = calculateDistance(playerCity, targetCity);

        const unitsBeingSent = isDifferentIsland ? ships : units;
        const slowestSpeed = Object.entries(unitsBeingSent || {})
            .filter(([, count]) => count > 0)
            .reduce((minSpeed, [unitId]) => Math.min(minSpeed, unitConfig[unitId].speed), Infinity);

        if (slowestSpeed === Infinity) {
            setMessage("No units selected for movement.");
            return false;
        }

        const travelSeconds = calculateTravelTime(distance, slowestSpeed);
        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);

        const movementData = {
            type: mode, // This will now be 'attack' for both city and village attacks
            originCityId: playerCity.id,
            originOwnerId: currentUser.uid,
            originCityName: playerCity.cityName,
            targetCityId: targetCity.id,
            targetOwnerId: targetCity.ownerId,
            ownerUsername: targetCity.ownerUsername,
            targetCityName: targetCity.cityName,
            units,
            ships: ships || {}, // Add ships to the movement data
            resources: resources || {},
            departureTime: serverTimestamp(),
            arrivalTime,
            status: 'moving',
            attackFormation: attackFormation || {},
            involvedParties: [currentUser.uid, targetCity.ownerId].filter(id => id),
            isVillageTarget: !!targetCity.isVillageTarget,
        };

        batch.set(newMovementRef, movementData);

        const newGameState = JSON.parse(JSON.stringify(gameState));
        for (const unitId in units) { newGameState.units[unitId] = (newGameState.units[unitId] || 0) - units[unitId]; }
        for (const unitId in ships) { newGameState.units[unitId] = (newGameState.units[unitId] || 0) - ships[unitId]; }
        if (resources) { for (const resource in resources) { newGameState.resources[resource] -= resources[resource]; } }

        try {
            await batch.commit();
            setGameState(newGameState);
            setMessage(`Movement sent to ${targetCity.cityName || targetCity.name}!`);
            return true;
        } catch (error) {
            console.error("Error sending movement:", error);
            setMessage(`Failed to send movement: ${error.message}`);
            return false;
        }
    };

    return { handleSendMovement };
};