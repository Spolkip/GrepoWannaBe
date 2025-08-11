// src/hooks/useMovementProcessor.js
import { useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { resolveCombat, resolveScouting, getVillageTroops } from '../utils/combat';
import { useCityState } from './useCityState';
import unitConfig from '../gameData/units.json';

/**
 * #comment A custom hook to process completed troop movements.
 */
export const useMovementProcessor = (worldId) => {
    const { getHospitalCapacity } = useCityState(worldId);

    const processMovement = useCallback(async (movementDoc) => {
        console.log(`Processing movement ID: ${movementDoc.id}`);
        const movement = { id: movementDoc.id, ...movementDoc.data() };
        console.log("Full movement data:", JSON.stringify(movement, null, 2)); // Added for debugging
        const batch = writeBatch(db);

        const originCityRef = doc(db, `users/${movement.originOwnerId}/games`, worldId, 'cities', movement.originCityId);
        
        let targetCityRef;
        if (movement.targetOwnerId && movement.targetCityId) {
            targetCityRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId, 'cities', movement.targetCityId);
        }

        const [originCitySnap, targetCitySnap] = await Promise.all([
            getDoc(originCityRef),
            targetCityRef ? getDoc(targetCityRef) : Promise.resolve(null)
        ]);
        
        if (!originCitySnap.exists()) {
            console.log(`Origin city ${movement.originOwnerId} for owner ${movement.originOwnerId} not found. Deleting movement.`);
            batch.delete(movementDoc.ref);
            await batch.commit();
            return;
        }
        
        const originCityState = originCitySnap.data();

        if (movement.status === 'returning') {
            console.log(`Movement ${movement.id} is returning.`);
            const newCityState = { ...originCityState };

            const newUnits = { ...newCityState.units };
            for (const unitId in movement.units) {
                newUnits[unitId] = (newUnits[unitId] || 0) + movement.units[unitId];
            }
            
            const newResources = { ...newCityState.resources };
            if (movement.resources) {
                for (const resourceId in movement.resources) {
                    newResources[resourceId] = (newResources[resourceId] || 0) + movement.resources[resourceId];
                }
            }
            // #comment Handle wounded troops
            const newWounded = { ...newCityState.wounded };
            let totalWoundedInHospital = Object.values(newWounded).reduce((sum, count) => sum + count, 0);
            const hospitalCapacity = getHospitalCapacity(newCityState.buildings.hospital?.level || 0);
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
                title: `Troops returned to ${originCityState.cityName}`,
                timestamp: serverTimestamp(),
                units: movement.units,
                resources: movement.resources || {},
                wounded: movement.wounded || {},
                read: false,
            };
            batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), returnReport);
            batch.update(originCityRef, { units: newUnits, resources: newResources, wounded: newWounded });
            batch.delete(movementDoc.ref);
            console.log(`Movement ${movement.id} processed and deleted.`);
        } else if (movement.status === 'moving') {
            console.log(`Movement ${movement.id} is moving with type: ${movement.type}`);
            const targetCityState = targetCitySnap?.exists() ? targetCitySnap.data() : null;

            switch (movement.type) {
                case 'attack_god_town': {
                    console.log(`Processing God Town attack: ${movement.id}`);
                    const townRef = doc(db, 'worlds', worldId, 'godTowns', movement.targetTownId);
                    const townSnap = await getDoc(townRef);
                
                    if (!townSnap.exists() || townSnap.data().stage !== 'city') {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            arrivalTime: returnArrivalTime,
                            involvedParties: [movement.originOwnerId]
                        });
                        break;
                    }
                
                    const townData = townSnap.data();
                    const combatResult = resolveCombat(movement.units, townData.troops, {}, false);
                
                    const damageDealt = Object.values(combatResult.defenderLosses).reduce((sum, count) => sum + count, 0) * 5;
                    const newHealth = Math.max(0, (townData.health || 10000) - damageDealt);
                    
                    const warPoints = Math.floor(damageDealt / 10);
                    const resourcesWon = {
                        wood: warPoints * 10,
                        stone: warPoints * 10,
                        silver: warPoints * 5
                    };
                
                    const playerProgressRef = doc(db, 'worlds', worldId, 'godTowns', movement.targetTownId, 'playerProgress', movement.originOwnerId);
                    const playerProgressSnap = await getDoc(playerProgressRef);
                    const currentDamage = playerProgressSnap.exists() ? playerProgressSnap.data().damageDealt : 0;
                    batch.set(playerProgressRef, { damageDealt: currentDamage + damageDealt }, { merge: true });
                
                    const attackerReport = {
                        type: 'attack_god_town',
                        title: `Attack on ${townData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: combatResult,
                        rewards: { warPoints, resources: resourcesWon },
                        read: false,
                    };

                    if (newHealth === 0) {
                        batch.delete(townRef);
                        attackerReport.rewards.message = "You have vanquished the City of the Gods! It has vanished from the world.";
                    } else {
                        const newTroops = { ...townData.troops };
                        for (const unitId in combatResult.defenderLosses) {
                            newTroops[unitId] = Math.max(0, (newTroops[unitId] || 0) - combatResult.defenderLosses[unitId]);
                        }
                        batch.update(townRef, { health: newHealth, troops: newTroops });
                    }
                    
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
                
                    const survivingAttackers = {};
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (combatResult.attackerLosses[unitId] || 0);
                        if (survivors > 0) survivingAttackers[unitId] = survivors;
                    }
                
                    const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                    const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                    batch.update(movementDoc.ref, {
                        status: 'returning',
                        units: survivingAttackers,
                        resources: resourcesWon,
                        arrivalTime: returnArrivalTime,
                        involvedParties: [movement.originOwnerId]
                    });
                
                    break;
                }
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
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), report);
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
                            lastCollected: serverTimestamp(),
                            happiness: 100,
                            happinessLastUpdated: serverTimestamp()
                        }, { merge: true });
                    }
                    
                    // #comment Create a version of the outcome without battle points for the report
                    const reportOutcome = { ...result };
                    delete reportOutcome.attackerBattlePoints;
                    delete reportOutcome.defenderBattlePoints;

                    const attackerReport = {
                        type: 'attack_village',
                        title: `Attack on ${villageData.name}`,
                        timestamp: serverTimestamp(),
                        outcome: reportOutcome,
                        attacker: { cityName: originCityState.cityName, units: movement.units, losses: result.attackerLosses },
                        defender: { villageName: villageData.name, troops: villageTroops, losses: result.defenderLosses },
                        read: false,
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);

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
                            involvedParties: [movement.originOwnerId]
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
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), report);
                        break;
                    }

                    const ruinData = ruinSnap.data();
                    if (ruinData.ownerId) {
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    
                    const result = resolveCombat(movement.units, ruinData.troops, {}, true);

                    // #comment Update attacker's battle points
                    if (result.attackerBattlePoints > 0) {
                        const attackerGameRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
                        const attackerGameDoc = await getDoc(attackerGameRef);
                        if (attackerGameDoc.exists()) {
                            const currentPoints = attackerGameDoc.data().battlePoints || 0;
                            batch.update(attackerGameRef, { battlePoints: currentPoints + result.attackerBattlePoints });
                        }
                    }

                    if (result.attackerWon) {
                        const newCityState = { ...originCityState };
                        if (!newCityState.research) newCityState.research = {};
                        newCityState.research[ruinData.researchReward] = true;
                        batch.update(originCityRef, { research: newCityState.research });
                        
                        batch.update(ruinRef, { 
                            ownerId: movement.originOwnerId, 
                            ownerUsername: movement.originOwnerUsername 
                        });

                        const playerRuinRef = doc(db, `users/${movement.originOwnerId}/games/${worldId}/conqueredRuins`, movement.targetRuinId);
                        batch.set(playerRuinRef, {
                            conqueredAt: serverTimestamp(),
                            researchReward: ruinData.researchReward
                        });
                    } else {
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
                        attacker: { 
                            cityName: originCityState.cityName, 
                            units: movement.units, 
                            losses: result.attackerLosses,
                            ownerId: movement.originOwnerId,
                            username: movement.originOwnerUsername || 'Unknown Player',
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        defender: { 
                            ruinName: ruinData.name, 
                            troops: ruinData.troops, 
                            losses: result.defenderLosses
                        },
                        reward: result.attackerWon ? ruinData.researchReward : null,
                        read: false,
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);

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
                            involvedParties: [movement.originOwnerId]
                        });
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    break;
                }
                case 'attack': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const result = resolveCombat(
                        movement.units, 
                        targetCityState.units, 
                        targetCityState.resources, 
                        !!movement.isCrossIsland,
                        movement.attackFormation?.front,
                        movement.attackFormation?.mid
                    );

                    // #comment Update battle points for both players
                    await runTransaction(db, async (transaction) => {
                        const attackerGameRef = doc(db, `users/${movement.originOwnerId}/games`, worldId);
                        const defenderGameRef = doc(db, `users/${movement.targetOwnerId}/games`, worldId);

                        const attackerGameDoc = await transaction.get(attackerGameRef);
                        const defenderGameDoc = await transaction.get(defenderGameRef);

                        if (attackerGameDoc.exists() && result.attackerBattlePoints > 0) {
                            const currentPoints = attackerGameDoc.data().battlePoints || 0;
                            transaction.update(attackerGameRef, { battlePoints: currentPoints + result.attackerBattlePoints });
                        }
                        if (defenderGameDoc.exists() && result.defenderBattlePoints > 0) {
                            const currentPoints = defenderGameDoc.data().battlePoints || 0;
                            transaction.update(defenderGameRef, { battlePoints: currentPoints + result.defenderBattlePoints });
                        }
                    });


                    const newDefenderUnits = { ...targetCityState.units };
                    for (const unitId in result.defenderLosses) {
                        newDefenderUnits[unitId] = Math.max(0, (newDefenderUnits[unitId] || 0) - result.defenderLosses[unitId]);
                    }

                    const newDefenderResources = { ...targetCityState.resources };
                    if (result.attackerWon) {
                        newDefenderResources.wood = Math.max(0, newDefenderResources.wood - result.plunder.wood);
                        newDefenderResources.stone = Math.max(0, newDefenderResources.stone - result.plunder.stone);
                        newDefenderResources.silver = Math.max(0, newDefenderResources.silver - result.plunder.silver);
                    }
                    
                    const survivingAttackers = {};
                    for (const unitId in movement.units) {
                        const survivors = movement.units[unitId] - (result.attackerLosses[unitId] || 0) - (result.wounded[unitId] || 0);
                        if (survivors > 0) {
                            survivingAttackers[unitId] = survivors;
                        }
                    }

                    const hasSurvivingLandOrMythic = Object.keys(survivingAttackers).some(unitId => {
                        const unit = unitConfig[unitId];
                        return unit && (unit.type === 'land' || unit.mythical);
                    });

                    const attackerReport = {
                        type: 'attack',
                        title: `Attack on ${targetCityState.cityName}`,
                        timestamp: serverTimestamp(),
                        outcome: result,
                        attacker: { 
                            cityName: originCityState.cityName, 
                            units: movement.units, 
                            losses: result.attackerLosses,
                            ownerId: movement.originOwnerId,
                            username: movement.originOwnerUsername || 'Unknown Player',
                            x: originCityState.x,
                            y: originCityState.y
                        },
                        defender: hasSurvivingLandOrMythic
                            ? { 
                                cityName: targetCityState.cityName, 
                                units: targetCityState.units, 
                                losses: result.defenderLosses,
                                ownerId: movement.targetOwnerId,
                                username: movement.ownerUsername || 'Unknown Player',
                                x: targetCityState.x,
                                y: targetCityState.y
                            }
                            : { cityName: targetCityState.cityName, units: {}, losses: {} },
                        read: false,
                    };

                    if (!hasSurvivingLandOrMythic) {
                        attackerReport.outcome.message = "Your forces were annihilated. No information could be gathered from the battle.";
                    }

                    const defenderReport = { 
                        ...attackerReport, 
                        title: `Defense against ${originCityState.cityName}`, 
                        read: false,
                        outcome: { ...result, attackerWon: !result.attackerWon },
                        defender: { 
                            cityName: targetCityState.cityName, 
                            units: targetCityState.units, 
                            losses: result.defenderLosses,
                            ownerId: movement.targetOwnerId,
                            username: movement.ownerUsername || 'Unknown Player',
                            x: targetCityState.x,
                            y: targetCityState.y
                        }
                    };

                    batch.update(targetCityRef, { units: newDefenderUnits, resources: newDefenderResources });

                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), attackerReport);
                    if (movement.targetOwnerId) {
                        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), defenderReport);
                    }

                    if (Object.keys(survivingAttackers).length > 0 || Object.keys(result.wounded).length > 0) {
                        const travelDuration = movement.arrivalTime.toMillis() - movement.departureTime.toMillis();
                        const returnArrivalTime = new Date(movement.arrivalTime.toDate().getTime() + travelDuration);
                        batch.update(movementDoc.ref, {
                            status: 'returning',
                            units: survivingAttackers,
                            resources: result.plunder,
                            wounded: result.wounded,
                            arrivalTime: returnArrivalTime,
                            involvedParties: [movement.originOwnerId]
                        });
                    } else {
                        batch.delete(movementDoc.ref);
                    }
                    break;
                }
                case 'scout': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const attackingSilver = movement.resources?.silver || 0;
                    const result = resolveScouting(targetCityState, attackingSilver);

                     if (result.success) {
                        const scoutReport = {
                            type: 'scout',
                            title: `Scout report of ${targetCityState.cityName}`,
                            timestamp: serverTimestamp(),
                            scoutSucceeded: true, 
                            ...result,
                            targetOwnerUsername: movement.ownerUsername,
                            read: false, 
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), scoutReport);
                    } else {
                        const failedScoutAttackerReport = {
                            type: 'scout',
                            title: `Scouting ${targetCityState.cityName} failed`,
                            timestamp: serverTimestamp(),
                            scoutSucceeded: false, 
                            message: result.message,
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), failedScoutAttackerReport);

                        const newDefenderCave = { ...targetCityState.cave, silver: (targetCityState.cave?.silver || 0) + result.silverGained };
                        batch.update(targetCityRef, { cave: newDefenderCave });

                        const spyCaughtReport = {
                            type: 'spy_caught',
                            title: `Caught a spy from ${originCityState.cityName}!`,
                            timestamp: serverTimestamp(),
                            originCity: originCityState.cityName,
                            silverGained: result.silverGained,
                            read: false,
                        };
                        batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), spyCaughtReport);
                    }
                    batch.delete(movementDoc.ref);
                    break;
                }
                case 'reinforce': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const newTargetUnits = { ...targetCityState.units };
                    for (const unitId in movement.units) {
                        newTargetUnits[unitId] = (newTargetUnits[unitId] || 0) + movement.units[unitId];
                    }
                    batch.update(targetCityRef, { units: newTargetUnits });

                    const reinforceReport = { type: 'reinforce', title: `Reinforcement to ${targetCityState.cityName}`, timestamp: serverTimestamp(), units: movement.units, read: false };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), reinforceReport);

                    const arrivalReport = { type: 'reinforce', title: `Reinforcements from ${originCityState.cityName}`, timestamp: serverTimestamp(), units: movement.units, read: false };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), arrivalReport);

                    batch.delete(movementDoc.ref);
                    break;
                }
                case 'trade': {
                    if (!targetCityState) {
                        console.log(`Target game state not found for movement ${movement.id}. Deleting.`);
                        batch.delete(movementDoc.ref);
                        break;
                    }
                    const newTargetResources = { ...targetCityState.resources };
                    for (const resource in movement.resources) {
                        newTargetResources[resource] = (newTargetResources[resource] || 0) + movement.resources[resource];
                    }
                    batch.update(targetCityRef, { resources: newTargetResources });

                    const tradeReport = { 
                        type: 'trade', 
                        title: `Trade to ${targetCityState.cityName}`, 
                        timestamp: serverTimestamp(), 
                        resources: movement.resources, 
                        read: false,
                        originCityName: originCityState.cityName,
                        targetCityName: targetCityState.cityName
                    };
                    batch.set(doc(collection(db, `users/${movement.originOwnerId}/worlds/${worldId}/reports`)), tradeReport);

                    const arrivalReport = { 
                        type: 'trade', 
                        title: `Trade from ${originCityState.cityName}`, 
                        timestamp: serverTimestamp(), 
                        resources: movement.resources, 
                        read: false,
                        originCityName: originCityState.cityName,
                        targetCityName: targetCityState.cityName
                    };
                    batch.set(doc(collection(db, `users/${movement.targetOwnerId}/worlds/${worldId}/reports`)), arrivalReport);

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

        const interval = setInterval(processMovements, 5000); // #comment Check every 5 seconds
        return () => clearInterval(interval);
    }, [worldId, processMovement]);
};
