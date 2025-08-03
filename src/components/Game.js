// src/components/Game.js
import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import CityView from './CityView';
import MapView from './MapView';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { resolveCombat, resolveScouting, getVillageTroops } from '../utils/combat';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useCityState } from '../hooks/useCityState';

const Game = ({ onBackToWorlds }) => {
    const { worldId, gameState, worldState } = useGame();
    const { getHospitalCapacity } = useCityState(worldId);
    const [view, setView] = useState('city'); // 'city' or 'map'
    const [isChatOpen, setIsChatOpen] = useState(false);

    // check and update season and weather for the world
    useEffect(() => {
        const checkForSeasonAndWeatherUpdate = async () => {
            if (!worldState) return;

            const now = new Date();
            const worldDocRef = doc(db, 'worlds', worldId);
            const batch = writeBatch(db);
            let needsUpdate = false;

            const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
            const weathers = ['Clear', 'Rainy', 'Windy', 'Foggy', 'Stormy'];

            // season changes every 7 days
            const seasonDuration = 7 * 24 * 60 * 60 * 1000;
            const lastSeasonUpdate = worldState.seasonLastUpdate?.toDate() || new Date(0);
            if (now.getTime() - lastSeasonUpdate.getTime() > seasonDuration) {
                const currentSeasonIndex = seasons.indexOf(worldState.season || 'Winter');
                const nextSeason = seasons[(currentSeasonIndex + 1) % seasons.length];
                batch.update(worldDocRef, { season: nextSeason, seasonLastUpdate: serverTimestamp() });
                needsUpdate = true;
            }

            // weather changes every 3 hours
            const weatherDuration = 3 * 60 * 60 * 1000;
            const lastWeatherUpdate = worldState.weatherLastUpdate?.toDate() || new Date(0);
            if (now.getTime() - lastWeatherUpdate.getTime() > weatherDuration) {
                const nextWeather = weathers[Math.floor(Math.random() * weathers.length)];
                batch.update(worldDocRef, { weather: nextWeather, weatherLastUpdate: serverTimestamp() });
                needsUpdate = true;
            }

            if (needsUpdate) {
                try {
                    await batch.commit();
                    console.log("Season/Weather updated by client check.");
                } catch (error) {
                    console.error("Error updating season/weather: ", error);
                }
            }
        };

        checkForSeasonAndWeatherUpdate();
    }, [worldId, worldState]);

    const processMovement = useCallback(async (movementDoc) => {
        console.log(`Processing movement ID: ${movementDoc.id}`);
        const movement = { id: movementDoc.id, ...movementDoc.data() };
        const batch = writeBatch(db);

        const originOwnerRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
        
        let targetOwnerRef;
        if (movement.targetOwnerId) {
            targetOwnerRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId);
        }

        const [originOwnerSnap, targetOwnerSnap] = await Promise.all([
            getDoc(originOwnerRef),
            targetOwnerRef ? getDoc(targetOwnerRef) : Promise.resolve(null)
        ]);
        
        if (!originOwnerSnap.exists()) {
            console.log(`Origin owner ${movement.originOwnerId} not found. Deleting movement.`);
            batch.delete(movementDoc.ref);
            await batch.commit();
            return;
        }
        
        const originGameState = originOwnerSnap.data();

        if (movement.status === 'returning') {
            console.log(`Movement ${movement.id} is returning.`);
            const newGameState = { ...originGameState };

            const newUnits = { ...newGameState.units };
            for (const unitId in movement.units) {
                newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
            }
            
            const newResources = { ...newGameState.resources };
            if (movement.resources) {
                for (const resourceId in movement.resources) {
                    newResources[resourceId] = (newResources[resourceId] || 0) + movement.resources[resourceId];
                }
            }
            // Handle wounded troops
            const newWounded = { ...newGameState.wounded };
            let totalWoundedInHospital = Object.values(newWounded).reduce((sum, count) => sum + count, 0);
            const hospitalCapacity = getHospitalCapacity(newGameState.buildings.hospital?.level || 0);
            if (movement.wounded) {
                for (const unitId in movement.wounded) {
                    const woundedCount = movement.wounded[unitId];
                    if (totalWoundedInHospital < hospitalCapacity) {
                        const canFit = hospitalCapacity - totalWoundedInHospital;
                        const toHeal = Math.min(canFit, woundedCount);
                        newWounded[unitId] = (newWounded[unitId] || 0) + toHeal;
                        totalWoundedInHospital += toHeal;
                    }
                }
            }
             const returnReport = {
                type: 'return',
                title: `Troops returned to ${originGameState.cityName}`,
                timestamp: serverTimestamp(),
                units: movement.units,
                resources: movement.resources || {},
                wounded: movement.wounded || {},
                read: false,
            };
            batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), returnReport);
            batch.update(originOwnerRef, { units: newUnits, resources: newResources, wounded: newWounded });
            batch.delete(movementDoc.ref);
            console.log(`Movement ${movement.id} processed and deleted.`);
        } else if (movement.status === 'moving') {
            console.log(`Movement ${movement.id} is moving with type: ${movement.type}`);
            const targetGameState = targetOwnerSnap?.exists() ? targetOwnerSnap.data() : null;

            switch (movement.type) {
                case 'attack_village': {
                    console.log(`Processing village attack: ${movement.id}`);
                    const villageRef = doc(db, 'worlds', worldId, 'villages', movement.targetVillageId);
                    const villageSnap = await getDoc(villageRef);

                    if (!villageSnap.exists()) {
                        console.log(`Village ${movement.targetVillageId} not found.`);
                        batch.delete(movementDoc.ref);
                        const report = {
                            type: 'attack_village',
                            title: `Attack on missing village`,
                            timestamp: serverTimestamp(),
                            outcome: { message: 'The village was no longer there.' },
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), report);
                        break;
                    }

                    const villageData = villageSnap.data();
                    const villageTroops = getVillageTroops(villageData);
                    const result = resolveCombat(movement.units, villageTroops, villageData.resources, false);
                    console.log('Village combat resolved:', result);
                    
                    if (result.attackerWon) {
                        console.log('Attacker won. Conquering/farming village.');
                        const playerVillageRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredVillages`, movement.targetVillageId);
                        
                        batch.set(playerVillageRef, { 
                            level: villageData.level,
                            lastCollected: serverTimestamp() 
                        }, { merge: true });
                    }

                    const attackerReport = {
                        type: 'attack_village',
                        title: `Attack on ${villageData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: result,
                        attacker: { cityName: originGameState.cityName, units: movement.units, losses: result.attackerLosses },
                        defender: { villageName: villageData.name, troops: villageTroops, losses: result.defenderLosses },
                        read: false,
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), attackerReport);

                    const survivingAttackers = {};
                    let anySurvivors = false;
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                            anySurvivors = true;
                        }
                    }

                    if (anySurvivors || Object.keys(result.wounded).length > 0) {
                        console.log('Survivors/wounded are returning.');
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            resources: result.plunder,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                        });
                    } else {
                        console.log('No survivors. Deleting movement.');
                        batch.delete(movementDoc.ref);
                    }
                    break;
                }
                case 'attack_ruin': {
                    console.log(`Processing ruin attack: ${movement.id}`);
                    const ruinRef = doc(db, 'worlds', worldId, 'ruins', movement.targetRuinId);
                    const ruinSnap = await getDoc(ruinRef);

                    if (!ruinSnap.exists()) {
                        console.log(`Ruin ${movement.targetRuinId} not found.`);
                        batch.delete(movementDoc.ref);
                        const report = {
                            type: 'attack_ruin',
                            title: `Attack on vanished ruins`,
                            timestamp: serverTimestamp(),
                            outcome: { message: 'The ruins crumbled into the sea before your fleet arrived.' },
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), report);
                        break;
                    }

                    const ruinData = ruinSnap.data();
                    if (ruinData.ownerId) { // Check if already conquered
                        batch.delete(movementDoc.ref); // Just delete the movement
                        break;
                    }
                    
                    const result = resolveCombat(movement.units, ruinData.troops, {}, true);

                    if (result.attackerWon) {
                        const newGameState = { ...originGameState };
                        if (!newGameState.research) newGameState.research = {};
                        newGameState.research[ruinData.researchReward] = true;
                        batch.update(originOwnerRef, { research: newGameState.research });
                        
                        // #comment Mark ruin as conquered instead of deleting
                        batch.update(ruinRef, { 
                            ownerId: movement.originOwnerId, 
                            ownerUsername: movement.originOwnerUsername 
                        });

                        // #comment Add to player's subcollection of conquered ruins
                        const playerRuinRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredRuins`, movement.targetRuinId);
                        batch.set(playerRuinRef, {
                            conqueredAt: serverTimestamp(),
                            researchReward: ruinData.researchReward
                        });
                    } else {
                        // #comment Attacker lost, update ruin with surviving troops
                        const survivingRuinTroops = { ...ruinData.troops };
                        for (const unitId in result.defenderLosses) {
                            survivingRuinTroops[unitId] = Math.max(0, (survivingRuinTroops[unitId] || 0) - result.defenderLosses[unitId]);
                        }
                        batch.update(ruinRef, { troops: survivingRuinTroops });
                    }

                    const attackerReport = {
                        type: 'attack_ruin',
                        title: `Attack on ${ruinData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: result,
                        attacker: { cityName: originGameState.cityName, units: movement.units, losses: result.attackerLosses },
                        defender: { ruinName: ruinData.name, troops: ruinData.troops, losses: result.defenderLosses },
                        reward: result.attackerWon ? ruinData.researchReward : null,
                        read: false,
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), attackerReport);

                    const survivingAttackers = {};
                    let anySurvivors = false;
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                            anySurvivors = true;
                        }
                    }

                    if (anySurvivors || Object.keys(result.wounded).length > 0) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                        });
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    break;
                }
                case 'attack': {
                    if (!targetGameState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const result = resolveCombat(
                        movement.units, 
                        targetGameState.units, 
                        targetGameState.resources, 
                        !!movement.isCrossIsland,
                        movement.attackFormation?.front,
                        movement.attackFormation?.mid
                    );

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
                        defender: { cityName: targetGameState.cityName, units: targetGameState.units, losses: result.defenderLosses },
                        read: false,
                    };
                    const defenderReport = { 
                        ...attackerReport, 
                        title: `Defense against ${originGameState.cityName}`, 
                        read: false,
                        outcome: { ...result, attackerWon: !result.attackerWon } 
                    };

                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), attackerReport);
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), defenderReport);

                    const survivingAttackers = {};
                    let anySurvivors = false;
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                            anySurvivors = true;
                        }
                    }

                    if (anySurvivors || Object.keys(result.wounded).length > 0) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            resources: result.plunder,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                        });
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    break;
                }
                case 'scout': {
                    if (!targetGameState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const attackingSilver = movement.resources?.silver || 0;
                    const result = resolveScouting(targetGameState, attackingSilver);

                     if (result.success) {
                        const scoutReport = {
                            type: 'scout',
                            title: `Scout report of ${targetGameState.cityName}`,
                            timestamp: serverTimestamp(),
                            scoutSucceeded: true, 
                            ...result,
                            targetOwnerUsername: movement.ownerUsername,
                            read: false, 
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), scoutReport);
                    } else {
                        const failedScoutAttackerReport = {
                            type: 'scout',
                            title: `Scouting ${targetGameState.cityName} failed`,
                            timestamp: serverTimestamp(),
                            scoutSucceeded: false, 
                            message: result.message,
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), failedScoutAttackerReport);

                        const newDefenderCave = { ...targetGameState.cave, silver: (targetGameState.cave?.silver || 0) + result.silverGained };
                        batch.update(targetOwnerRef, { cave: newDefenderCave });

                        const spyCaughtReport = {
                            type: 'spy_caught',
                            title: `Caught a spy from ${originGameState.cityName}!`,
                            timestamp: serverTimestamp(),
                            originCity: originGameState.cityName,
                            silverGained: result.silverGained,
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), spyCaughtReport);
                    }
                    batch.delete(movementDoc.ref);
                    break;
                }
                case 'reinforce': {
                    if (!targetGameState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const newTargetUnits = { ...targetGameState.units };
                    for (const unitId in movement.units) {
                        newTargetUnits[unitId] = (newTargetUnits[unitId] || 0) + movement.units[unitId];
                    }
                    batch.update(targetOwnerRef, { units: newTargetUnits });

                    const reinforceReport = { type: 'reinforce', title: `Reinforcement to ${targetGameState.cityName}`, timestamp: serverTimestamp(), units: movement.units, read: false };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), reinforceReport);

                    const arrivalReport = { type: 'reinforce', title: `Reinforcements from ${originGameState.cityName}`, timestamp: serverTimestamp(), units: movement.units, read: false };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), arrivalReport);

                    batch.delete(movementDoc.ref);
                    break;
                }
                case 'trade': {
                    if (!targetGameState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const newTargetResources = { ...targetGameState.resources };
                    for (const resource in movement.resources) {
                        newTargetResources[resource] = (newTargetResources[resource] || 0) + movement.resources[resource];
                    }
                    batch.update(targetOwnerRef, { resources: newTargetResources });

                    const tradeReport = { type: 'trade', title: `Trade to ${targetGameState.cityName}`, timestamp: serverTimestamp(), resources: movement.resources, read: false };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/reports`)), tradeReport);

                    const arrivalReport = { type: 'trade', title: `Trade from ${originGameState.cityName}`, timestamp: serverTimestamp(), resources: movement.resources, read: false };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/reports`)), arrivalReport);

                    batch.delete(movementDoc.ref);
                    break;
                }
                default:
                    console.log(`Unknown movement type: ${movement.type}. Deleting movement ${movement.id}`);
                    batch.delete(movementDoc.ref);
                    break;
            }
        }
        await batch.commit();
        console.log(`Batch commit successful for movement ${movement.id}`);
    }, [worldId, getHospitalCapacity]);

    useEffect(() => {
        const processMovements = async () => {
            if (!worldId) return;

            const movementsRef = collection(db, 'worlds', worldId, 'movements');
            const q = query(movementsRef, where('arrivalTime', '<=', new Date()));

            const arrivedMovementsSnapshot = await getDocs(q);
            if (arrivedMovementsSnapshot.empty) return;

            console.log(`Found ${arrivedMovementsSnapshot.docs.length} arrived movements to process.`);
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
            
            <div className="chat-container">
                <button onClick={() => setIsChatOpen(prev => !prev)} className="chat-toggle-button">
                    💬
                </button>
                <Chat 
                    isVisible={isChatOpen} 
                    onClose={() => setIsChatOpen(false)} 
                />
            </div>
        </div>
    );
};

export default Game;