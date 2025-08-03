// src/utils/combat.js
import unitConfig from '../gameData/units.json';

/**
 * Resolves a battle between attacking and defending units of a specific type.
 * Incorporates phalanx, support, and counter unit logic.
 * @param {object} attackingUnits - Units of the attacker.
 * @param {object} defendingUnits - Units of the defender.
 * @param {string} unitType - 'land' or 'naval'.
 * @param {string|null} attackerPhalanx - The unit ID chosen as phalanx by the attacker.
 * @param {string|null} attackerSupport - The unit ID chosen as support by the attacker.
 * @param {string|null} defenderPhalanx - The unit ID chosen as phalanx by the defender.
 * @param {string|null} defenderSupport - The unit ID chosen as support by the defender.
 * @returns {object} Battle results including attackerWon, attackerLosses, defenderLosses.
 */
const resolveBattle = (attackingUnits, defendingUnits, unitType, attackerPhalanx, attackerSupport, defenderPhalanx, defenderSupport) => {
    // Check if either side has units of the required type
    const hasAttackingUnits = Object.entries(attackingUnits || {}).some(
        ([unitId, count]) => count > 0 && unitConfig[unitId]?.type === unitType && unitConfig[unitId]?.attack > 0
    );
    const hasDefendingUnits = Object.entries(defendingUnits || {}).some(
        ([unitId, count]) => count > 0 && unitConfig[unitId]?.type === unitType
    );

    // If the defender has no relevant units, the attacker automatically wins this phase.
    if (!hasDefendingUnits) {
        return {
            attackerWon: true,
            attackerLosses: {},
            defenderLosses: {},
        };
    }
    
    // If the attacker has no relevant combat units, but the defender does, the attacker loses.
    if (!hasAttackingUnits) {
        return {
            attackerWon: false,
            attackerLosses: {},
            defenderLosses: {},
        };
    }

    let currentAttackingUnits = { ...attackingUnits };
    let currentDefendingUnits = { ...defendingUnits };

    // Function to calculate effective power considering counters
    const calculateEffectivePower = (units, opponentUnits, isAttacker, phalanxUnit, supportUnit) => {
        let totalPower = 0;
        let phalanxPower = 0;
        let supportPower = 0;
        let otherPower = 0;

        for (const unitId in units) {
            const unitCount = units[unitId] || 0;
            if (unitCount === 0) continue;

            const unitInfo = unitConfig[unitId];
            if (!unitInfo || unitInfo.type !== unitType) continue;

            let attack = unitInfo.attack;
            let defense = unitInfo.defense;

            // Apply counter bonuses
            for (const opponentUnitId in opponentUnits) {
                const opponentUnitCount = opponentUnits[opponentUnitId] || 0;
                if (opponentUnitCount > 0) {
                    const opponentUnitInfo = unitConfig[opponentUnitId];
                    if (unitInfo.counters && unitInfo.counters.includes(opponentUnitId)) {
                        // If this unit counters the opponent unit, gain bonus attack
                        attack *= 1.2; // 20% attack bonus
                    }
                    if (opponentUnitInfo.counters && opponentUnitInfo.counters.includes(unitId)) {
                        // If opponent unit counters this unit, this unit's defense is reduced
                        defense *= 0.8; // 20% defense penalty
                    }
                }
            }

            const unitPower = unitCount * (isAttacker ? attack : defense);

            if (unitId === phalanxUnit) {
                phalanxPower += unitPower;
            } else if (unitId === supportUnit) {
                supportPower += unitPower;
            } else {
                otherPower += unitPower;
            }
            totalPower += unitPower;
        }
        return { totalPower, phalanxPower, supportPower, otherPower };
    };

    const attackerStats = calculateEffectivePower(currentAttackingUnits, currentDefendingUnits, true, attackerPhalanx, attackerSupport);
    const defenderStats = calculateEffectivePower(currentDefendingUnits, currentAttackingUnits, false, defenderPhalanx, defenderSupport);

    // Simplified combat rounds (can be expanded for more complexity)
    // Phalanx units engage first
    let initialAttackerPower = attackerStats.phalanxPower + attackerStats.supportPower * 0.5 + attackerStats.otherPower * 0.2; // Support and other units contribute less initially
    let initialDefenderPower = defenderStats.phalanxPower + defenderStats.supportPower * 0.5 + defenderStats.otherPower * 0.2;

    // Determine initial losses based on overall power
    const attackerLossRatio = Math.min(1, initialDefenderPower / (initialAttackerPower || 1));
    const defenderLossRatio = Math.min(1, initialAttackerPower / (initialDefenderPower || 1));

    // Apply losses based on role: phalanx takes more, then support, then others
    const applyLosses = (units, lossRatio, phalanx, support) => {
        const totalUnits = Object.values(units).reduce((sum, count) => sum + count, 0);
        if (totalUnits === 0) return {};

        const losses = {};
        let remainingLosses = Math.floor(totalUnits * lossRatio);

        // Prioritize losses for phalanx
        if (phalanx && units[phalanx] && remainingLosses > 0) {
            const phalanxLoss = Math.min(units[phalanx], Math.ceil(remainingLosses * 0.6)); // Phalanx takes 60% of initial losses
            losses[phalanx] = phalanxLoss;
            remainingLosses -= phalanxLoss;
        }

        // Then support
        if (support && units[support] && remainingLosses > 0) {
            const supportLoss = Math.min(units[support], Math.ceil(remainingLosses * 0.3)); // Support takes 30%
            losses[support] = (losses[support] || 0) + supportLoss;
            remainingLosses -= supportLoss;
        }

        // Distribute remaining losses proportionally among other units
        const otherUnits = Object.keys(units).filter(id => id !== phalanx && id !== support && unitConfig[id]?.type === unitType);
        if (remainingLosses > 0 && otherUnits.length > 0) {
            let currentOtherUnitsTotal = otherUnits.reduce((sum, id) => sum + (units[id] || 0) - (losses[id] || 0), 0);
            if (currentOtherUnitsTotal === 0) currentOtherUnitsTotal = 1; // Avoid division by zero

            for (const unitId of otherUnits) {
                if (remainingLosses > 0) {
                    const unitCount = (units[unitId] || 0) - (losses[unitId] || 0);
                    const proportionalLoss = Math.floor(remainingLosses * (unitCount / currentOtherUnitsTotal));
                    const actualLoss = Math.min(unitCount, proportionalLoss);
                    losses[unitId] = (losses[unitId] || 0) + actualLoss;
                    remainingLosses -= actualLoss;
                }
            }
            // Distribute any leftover losses to the largest remaining unit type
            if (remainingLosses > 0) {
                const largestRemainingUnit = otherUnits.reduce((largest, id) => {
                    const currentCount = (units[id] || 0) - (losses[id] || 0);
                    return currentCount > (units[largest] || 0) - (losses[largest] || 0) ? id : largest;
                }, otherUnits[0]);
                if (largestRemainingUnit) {
                    losses[largestRemainingUnit] = (losses[largestRemainingUnit] || 0) + remainingLosses;
                }
            }
        }
        
        // #comment Final check to ensure losses don't exceed the number of units
        for (const unitId in losses) {
            if (losses[unitId] > (units[unitId] || 0)) {
                losses[unitId] = units[unitId] || 0;
            }
        }

        return losses;
    };

    const finalAttackerLosses = applyLosses(currentAttackingUnits, attackerLossRatio, attackerPhalanx, attackerSupport);
    const finalDefenderLosses = applyLosses(currentDefendingUnits, defenderLossRatio, defenderPhalanx, defenderSupport);

    // Update current units after losses for the next calculation (if multiple rounds were simulated)
    for (const unitId in finalAttackerLosses) {
        currentAttackingUnits[unitId] = Math.max(0, (currentAttackingUnits[unitId] || 0) - finalAttackerLosses[unitId]);
    }
    for (const unitId in finalDefenderLosses) {
        currentDefendingUnits[unitId] = Math.max(0, (currentDefendingUnits[unitId] || 0) - finalDefenderLosses[unitId]);
    }

    // Recalculate power with remaining units to determine winner
    const finalAttackerPower = calculateEffectivePower(currentAttackingUnits, currentDefendingUnits, true, null, null).totalPower;
    const finalDefenderPower = calculateEffectivePower(currentDefendingUnits, currentAttackingUnits, false, null, null).totalPower;
    
    // Attacker wins on a tie (e.g., 0 vs 0 power)
    return {
        attackerWon: finalAttackerPower >= finalDefenderPower,
        attackerLosses: finalAttackerLosses,
        defenderLosses: finalDefenderLosses,
    };
};
export function getVillageTroops(villageData) {
    if (villageData.troops && Object.keys(villageData.troops).length > 0) {
        return villageData.troops;
    }

    const level = villageData.level || 1;
    let troops = {};
    switch (level) {
        case 1:
            troops = { swordsman: 15, archer: 10 };
            break;
        case 2:
            troops = { swordsman: 25, archer: 15, slinger: 5 };
            break;
        case 3:
            troops = { swordsman: 40, archer: 25, slinger: 10, hoplite: 5 };
            break;
        case 4:
            troops = { swordsman: 60, archer: 40, slinger: 20, hoplite: 15, cavalry: 5 };
            break;
        case 5:
            troops = { swordsman: 100, archer: 75, slinger: 50, hoplite: 40, cavalry: 20 };
            break;
        default:
            troops = { swordsman: 15, archer: 10 };
            break;
    }
    return troops;
}
export function resolveCombat(attackingUnits, defendingUnits, defendingResources, isNavalAttack, attackerPhalanx, attackerSupport, defenderPhalanx, defenderSupport) {
    let totalAttackerLosses = {};
    let totalDefenderLosses = {};
    let attackerWon = false;
    let plunder = { wood: 0, stone: 0, silver: 0 };
    let wounded = {};

    if (isNavalAttack) {
        const navalBattle = resolveBattle(attackingUnits, defendingUnits, 'naval', null, null, null, null); // No phalanx/support for naval
        totalAttackerLosses = { ...navalBattle.attackerLosses };
        totalDefenderLosses = { ...navalBattle.defenderLosses };

        if (navalBattle.attackerWon) {
            const survivingAttackers = { ...attackingUnits };
            for (const unitId in totalAttackerLosses) {
                survivingAttackers[unitId] = Math.max(0, (survivingAttackers[unitId] || 0) - totalAttackerLosses[unitId]);
            }

            const landBattle = resolveBattle(survivingAttackers, defendingUnits, 'land', attackerPhalanx, attackerSupport, defenderPhalanx, defenderSupport);
            for (const unitId in landBattle.attackerLosses) {
                totalAttackerLosses[unitId] = (totalAttackerLosses[unitId] || 0) + landBattle.attackerLosses[unitId];
            }
            for (const unitId in landBattle.defenderLosses) {
                totalDefenderLosses[unitId] = (totalDefenderLosses[unitId] || 0) + landBattle.defenderLosses[unitId];
            }
            
            attackerWon = landBattle.attackerWon;

            if (landBattle.attackerWon) {
                plunder.wood = Math.floor(defendingResources.wood * 0.25);
                plunder.stone = Math.floor(defendingResources.stone * 0.25);
                plunder.silver = Math.floor(defendingResources.silver * 0.25);
            }
        } else {
            // If naval battle is lost, all land units on transport ships are lost
            for (const unitId in attackingUnits) {
                if (unitConfig[unitId].type === 'land') {
                    totalAttackerLosses[unitId] = (totalAttackerLosses[unitId] || 0) + attackingUnits[unitId];
                }
            }
        }
    } else {
        const landBattle = resolveBattle(attackingUnits, defendingUnits, 'land', attackerPhalanx, attackerSupport, defenderPhalanx, defenderSupport);
        totalAttackerLosses = landBattle.attackerLosses;
        totalDefenderLosses = landBattle.defenderLosses;
        attackerWon = landBattle.attackerWon;
        if (landBattle.attackerWon) {
            plunder.wood = Math.floor(defendingResources.wood * 0.25);
            plunder.stone = Math.floor(defendingResources.stone * 0.25);
            plunder.silver = Math.floor(defendingResources.silver * 0.25);
        }
    }

    // Calculate wounded troops from attacker losses
    for (const unitId in totalAttackerLosses) {
        const losses = totalAttackerLosses[unitId];
        const unitType = unitConfig[unitId]?.type;
        // Only land units can be wounded and healed in a hospital
        if (unitType === 'land') {
            const woundedCount = Math.floor(losses * 0.15); // 15% of losses become wounded
            if (woundedCount > 0) {
                wounded[unitId] = woundedCount;
                totalAttackerLosses[unitId] = losses - woundedCount; // Reduce losses by the number of wounded
            }
        }
    }

    return {
        attackerWon,
        attackerLosses: totalAttackerLosses,
        defenderLosses: totalDefenderLosses,
        plunder,
        wounded,
    };
}
export function resolveVillageRetaliation(playerUnits) {
    const losses = {};
    if (!playerUnits) return losses;

    const totalPopulation = Object.entries(playerUnits).reduce((sum, [id, count]) => {
        return sum + (unitConfig[id]?.cost.population || 0) * count;
    }, 0);

    if (totalPopulation === 0) return losses;

    // #comment village retaliation causes a flat 5% loss of total army population value
    let populationToLose = totalPopulation * 0.05;

    // #comment distribute losses proportionally among land units
    for (const unitId in playerUnits) {
        if (unitConfig[unitId]?.type === 'land') {
            const unitPopulation = unitConfig[unitId].cost.population;
            if (unitPopulation > 0) {
                const unitProportion = (unitPopulation * playerUnits[unitId]) / totalPopulation;
                const unitsToLose = Math.round((populationToLose / unitPopulation) * unitProportion);
                losses[unitId] = Math.min(playerUnits[unitId], unitsToLose);
            }
        }
    }
    return losses;
}
/**
 * Resolves a scouting mission.
 * @param {object} targetGameState - The game state of the target city.
 * @param {number} attackingSilver - The amount of silver used for the scouting mission.
 * @returns {object} An object containing the scouting outcome.
 */
export function resolveScouting(targetGameState, attackingSilver) {
    const defenderCaveSilver = targetGameState.cave?.silver || 0; // Get silver in cave
    const defenderSecurityBonus = defenderCaveSilver * 2; // Example: defender gets 2x bonus from silver in cave
    const attackerEspionagePower = attackingSilver;

    // A simple probability model: higher attackerEspionagePower and lower defenderSecurityBonus increase success chance
    const successThreshold = 0.5; // Base chance to succeed without any silver
    const adjustedSuccessChance = (attackerEspionagePower + 1) / (attackerEspionagePower + defenderSecurityBonus + 1); // +1 to avoid division by zero and ensure some chance

    const success = Math.random() < adjustedSuccessChance && adjustedSuccessChance > successThreshold; // Only succeed if above a certain threshold

    if (success) {
        // If scouting is successful, return a report of target's resources and units
        return {
            success: true,
            message: 'Scouting successful! Detailed report obtained.',
            targetCityName: targetGameState.cityName,
            targetOwnerUsername: targetGameState.playerInfo?.username || 'Unknown', // Safely access username
            resources: { ...targetGameState.resources },
            units: { ...targetGameState.units },
            buildings: { ...targetGameState.buildings },
            god: targetGameState.god || 'None', // Include worshipped god
        };
    } else {
        // If scouting fails, attacker loses their silver (already deducted in movementmodal),
        // and defender gains some of the attacking silver if their cave silver was higher or it was a close call.
        // Let's say defender gains 50% of the attacking silver if scout fails.
        const silverGainedByDefender = Math.floor(attackingSilver * 0.5);
        return {
            success: false,
            message: 'Scouting failed! Your spy was detected.',
            silverGained: silverGainedByDefender
        };
    }
    
}
