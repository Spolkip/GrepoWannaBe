import { useEffect } from 'react';
import { writeBatch, doc, serverTimestamp, collection, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config'; // CORRECTED PATH
import { resolveCombat } from '../utils/combat'; // CORRECTED PATH

const PROCESSOR_INTERVAL = 5000; // 5 seconds

export const useProcessMovements = (movements, worldId, currentUser, userProfile, setGameState, setMessage) => {
    useEffect(() => {
        let timeoutId;

        const processCompletedMovements = async () => {
            if (!movements.length || !worldId || !currentUser || !db || !userProfile) {
                timeoutId = setTimeout(processCompletedMovements, PROCESSOR_INTERVAL);
                return;
            }

            const now = new Date();
            const completedMovements = movements.filter(m => m.arrivalTime && m.arrivalTime.toDate() <= now);

            if (completedMovements.length > 0) {
                const batch = writeBatch(db);

                for (const movement of completedMovements) {
                    const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
                    
                    if (movement.status === 'returning') {
                        const playerGameRef = doc(db, 'users', currentUser.uid, 'games', worldId);
                        const playerGameSnap = await getDoc(playerGameRef);
                        if (playerGameSnap.exists()) {
                            const playerData = playerGameSnap.data();
                            const updatedUnits = { ...playerData.units };
                            
                            // Return land units
                            for (const unitId in movement.units) {
                                updatedUnits[unitId] = (updatedUnits[unitId] || 0) + movement.units[unitId];
                            }
                            // Return naval units
                            for (const unitId in movement.ships) {
                                updatedUnits[unitId] = (updatedUnits[unitId] || 0) + movement.ships[unitId];
                            }
                            batch.update(playerGameRef, { units: updatedUnits });
                        }
                        batch.delete(movementRef);

                    } else if (movement.type === 'attack') {
                        const isNavalAttack = movement.ships && Object.values(movement.ships).reduce((a, b) => a + b, 0) > 0;
                        
                        const targetRef = movement.isVillageTarget
                            ? doc(db, 'worlds', worldId, 'villages', movement.targetCityId)
                            : doc(db, 'users', movement.targetOwnerId, 'games', worldId);

                        const targetSnap = await getDoc(targetRef);

                        if (targetSnap.exists()) {
                            const targetData = targetSnap.data();
                            
                            const combatResult = resolveCombat(
                                movement, 
                                targetData
                            );

                            // Update target's state
                            const newDefenderUnits = { ...(targetData.units || targetData.troops) };
                            for (const unitId in combatResult.defenderLosses) {
                                newDefenderUnits[unitId] = Math.max(0, newDefenderUnits[unitId] - combatResult.defenderLosses[unitId]);
                            }
                            const updateData = movement.isVillageTarget ? { troops: newDefenderUnits } : { units: newDefenderUnits };
                            batch.update(targetRef, updateData);

                            // Handle return trip
                            const survivingAttackers = { ...combatResult.survivingAttackers.units };
                            const survivingShips = { ...combatResult.survivingAttackers.ships };
                            
                            const anySurvivors = Object.values(survivingAttackers).some(c => c > 0) || Object.values(survivingShips).some(c => c > 0);

                            if (anySurvivors) {
                                const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                                const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                                batch.update(movementRef, {
                                    status: 'returning',
                                    units: survivingAttackers,
                                    ships: survivingShips,
                                    resources: combatResult.plunder || {},
                                    arrivalTime: returnArrivalTime
                                });
                            } else {
                                batch.delete(movementRef);
                            }
                        } else {
                             // Target doesn't exist, delete movement
                            batch.delete(movementRef);
                        }
                    } else {
                        // For non-attack movements like reinforce, trade, scout
                        // (You would add that logic here, for now, just deleting)
                        batch.delete(movementRef);
                    }
                }
                
                try {
                    await batch.commit();
                } catch(err) {
                    console.error("Error processing movements batch:", err);
                }
            }

            timeoutId = setTimeout(processCompletedMovements, PROCESSOR_INTERVAL);
        };

        timeoutId = setTimeout(processCompletedMovements, PROCESSOR_INTERVAL);
        return () => clearTimeout(timeoutId);

    }, [movements, worldId, currentUser, userProfile, setGameState, setMessage]);
};