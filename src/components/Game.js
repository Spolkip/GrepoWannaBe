import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import CityView from './CityView';
import MapView from './MapView';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { resolveCombat, resolveScouting } from '../utils/combat';
import LoadingScreen from './shared/LoadingScreen'; // Corrected import path

const Game = ({ onBackToWorlds }) => {
    const { worldId, gameState } = useGame();
    const [view, setView] = useState('city'); // 'city' or 'map'

    const processMovement = useCallback(async (movementDoc) => {
        const movement = { id: movementDoc.id, ...movementDoc.data() };
        const batch = writeBatch(db);

        const originOwnerRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
        const targetOwnerRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId);

        const [originOwnerSnap, targetOwnerSnap] = await Promise.all([
            getDoc(originOwnerRef),
            getDoc(targetOwnerRef)
        ]);

        if (!originOwnerSnap.exists() || !targetOwnerSnap.exists()) {
            batch.delete(movementDoc.ref);
            await batch.commit();
            return;
        }

        const originGameState = originOwnerSnap.data();
        const targetGameState = targetOwnerSnap.data();

        if (movement.status === 'returning') {
            const newUnits = { ...originGameState.units };
            for (const unitId in movement.units) {
                newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
            }
            batch.update(originOwnerRef, { units: newUnits });
            batch.delete(movementDoc.ref);
        } else if (movement.status === 'moving') {
            switch (movement.type) {
                case 'attack': {
                    const result = resolveCombat(movement.units, targetGameState.units, targetGameState.resources);

                    const newDefenderUnits = { ...targetGameState.units };
                    for (const unitId in result.defenderLosses) {
                        newDefenderUnits[unitId] = Math.max(0, (newDefenderUnits[unitId] || 0) - result.defenderLosses[unitId]);
                    }

                    const newDefenderResources = { ...targetGameState.resources };
                    if (result.attackerWon) {
                        newDefenderResources.wood = Math.max(0, newDefenderResources.wood - result.plunder.wood);
                        newDefenderResources.stone = Math.max(0, newDefenderResources.stone - result.plunder.stone);
                        newDefenderResources.silver = Math.max(0, newDefenderResources.silver - result.plunder.silver);
                    }

                    batch.update(targetOwnerRef, { units: newDefenderUnits, resources: newDefenderResources });

                    const attackerReport = {
                        type: 'attack',
                        title: `Attack on ${targetGameState.cityName}`,
                        timestamp: serverTimestamp(),
                        outcome: result,
                        attacker: { cityName: originGameState.cityName, units: movement.units, losses: result.attackerLosses },
                        defender: { cityName: targetGameState.cityName, units: targetGameState.units, losses: result.defenderLosses }
                    };
                    const defenderReport = { ...attackerReport, title: `Defense against ${originGameState.cityName}` };

                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), attackerReport);
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), defenderReport);

                    const survivingAttackers = {};
                    let anySurvivors = false;
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                            anySurvivors = true;
                        }
                    }

                    if (anySurvivors) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            resources: result.plunder,
                            arrivalTime: returnArrivalTime
                        });
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    break;
                }
                case 'scout': {
                    const attackingSilver = movement.resources?.silver || 0;
                    const result = resolveScouting(targetGameState, attackingSilver);

                    if (result.success) {
                        const scoutReport = {
                            type: 'scout',
                            title: `Scout report of ${targetGameState.cityName}`,
                            timestamp: serverTimestamp(),
                            outcome: result,
                            targetCityName: targetGameState.cityName,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), scoutReport);
                    } else {
                        const newDefenderCave = { ...targetGameState.cave, silver: (targetGameState.cave?.silver || 0) + result.silverGained };
                        batch.update(targetOwnerRef, { cave: newDefenderCave });

                        const failedScoutReport = {
                            type: 'scout_failed',
                            title: `Caught a spy from ${originGameState.cityName}!`,
                            timestamp: serverTimestamp(),
                            outcome: result,
                            originCity: originGameState.cityName,
                        };
                        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), failedScoutReport);
                    }
                    batch.delete(movementDoc.ref);
                    break;
                }
                case 'reinforce': {
                    const newTargetUnits = { ...targetGameState.units };
                    for (const unitId in movement.units) {
                        newTargetUnits[unitId] = (newTargetUnits[unitId] || 0) + movement.units[unitId];
                    }
                    batch.update(targetOwnerRef, { units: newTargetUnits });

                    const reinforceReport = { type: 'reinforce', title: `Reinforcement to ${targetGameState.cityName}`, timestamp: serverTimestamp(), units: movement.units };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), reinforceReport);

                    const arrivalReport = { type: 'reinforce', title: `Reinforcements from ${originGameState.cityName}`, timestamp: serverTimestamp(), units: movement.units };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), arrivalReport);

                    batch.delete(movementDoc.ref);
                    break;
                }
                case 'trade': {
                    const newTargetResources = { ...targetGameState.resources };
                    for (const resource in movement.resources) {
                        newTargetResources[resource] = (newTargetResources[resource] || 0) + movement.resources[resource];
                    }
                    batch.update(targetOwnerRef, { resources: newTargetResources });

                    const tradeReport = { type: 'trade', title: `Trade to ${targetGameState.cityName}`, timestamp: serverTimestamp(), resources: movement.resources };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), tradeReport);

                    const arrivalReport = { type: 'trade', title: `Trade from ${originGameState.cityName}`, timestamp: serverTimestamp(), resources: movement.resources };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), arrivalReport);

                    batch.delete(movementDoc.ref);
                    break;
                }
                default:
                    batch.delete(movementDoc.ref);
                    break;
            }
        }
        await batch.commit();
    }, [worldId]);

    useEffect(() => {
        const processMovements = async () => {
            if (!worldId) return;

            const movementsRef = collection(db, 'worlds', worldId, 'movements');
            const q = query(movementsRef, where('arrivalTime', '<=', new Date()));

            const arrivedMovementsSnapshot = await getDocs(q);
            if (arrivedMovementsSnapshot.empty) return;

            for (const movementDoc of arrivedMovementsSnapshot.docs) {
                try {
                    await processMovement(movementDoc);
                } catch (error) {
                    console.error("Error processing movement:", movementDoc.id, error);
                }
            }
        };

        const interval = setInterval(processMovements, 5000); // Check every 5 seconds
        return () => clearInterval(interval);
    }, [worldId, processMovement]);


    if (!gameState) {
        return <LoadingScreen message="Loading Game..." />;
    }

    const showMap = () => setView('map');
    const showCity = () => setView('city');

    return (
        <div className="w-full h-screen bg-gray-900 text-white">
            {view === 'city' && <CityView showMap={showMap} worldId={worldId} />}
            {view === 'map' && <MapView showCity={showCity} onBackToWorlds={onBackToWorlds} />}
        </div>
    );
};

export default Game;
