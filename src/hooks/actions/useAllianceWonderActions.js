// src/hooks/actions/useAllianceWonderActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, serverTimestamp } from "firebase/firestore";
import allianceWonders from '../../gameData/alliance_wonders.json';

// #comment Calculate the total cost to build a wonder level
const getWonderCost = (level) => {
    const costMultiplier = Math.pow(1.5, level);
    return {
        wood: Math.floor(100000 * costMultiplier),
        stone: Math.floor(100000 * costMultiplier),
        silver: Math.floor(50000 * costMultiplier)
    };
};

// #comment Get the current progress of the wonder
export const getWonderProgress = (alliance, wonderId) => {
    const progress = alliance?.wonderProgress?.[wonderId] || { wood: 0, stone: 0, silver: 0 };
    return progress;
};

export const useAllianceWonderActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState } = useGame();

    const donateToWonder = async (wonderId, donation, isInitialBuild = false) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', gameState.id);
        const eventRef = doc(collection(allianceDocRef, 'events'));

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!cityDoc.exists() || !allianceDoc.exists()) throw new Error("City or Alliance data not found.");

            const cityData = cityDoc.data();
            const allianceData = allianceDoc.data();
            
            if (isInitialBuild) {
                if (allianceData.allianceWonder) throw new Error("A wonder has already been selected.");
                const citiesOnIslandCount = allianceData.members.reduce((count, member) => count + allianceData.memberCities[member.uid]?.length || 0, 0);
                if (citiesOnIslandCount < 16) throw new Error("You must have all cities on the island to build a wonder.");
                
                transaction.update(allianceDocRef, {
                    allianceWonder: { id: wonderId, level: 0 },
                    wonderProgress: { [wonderId]: { wood: 0, stone: 0, silver: 0 } }
                });
                
                const eventText = `${userProfile.username} has started construction of the ${allianceWonders[wonderId].name}.`;
                transaction.set(eventRef, {
                    type: 'wonder_start',
                    text: eventText,
                    timestamp: serverTimestamp()
                });
                return;
            }

            const currentWonder = allianceData.allianceWonder;
            if (currentWonder.id !== wonderId) throw new Error("Cannot donate to this wonder, as it is not the active wonder.");

            const newPlayerResources = { ...cityData.resources };
            const newWonderProgress = { ...allianceData.wonderProgress[wonderId] };

            for (const resource in donation) {
                if ((newPlayerResources[resource] || 0) < donation[resource]) throw new Error(`Not enough ${resource} in your city.`);
                newPlayerResources[resource] -= donation[resource];
                newWonderProgress[resource] += donation[resource];
            }

            transaction.update(cityDocRef, { resources: newPlayerResources });
            transaction.update(allianceDocRef, { [`wonderProgress.${wonderId}`]: newWonderProgress });
        });
    };

    const claimWonderLevel = async (wonderId) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (playerAlliance.leader.uid !== currentUser.uid) throw new Error("Only the leader can claim wonder levels.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!allianceDoc.exists()) throw new Error("Alliance data not found.");

            const allianceData = allianceDoc.data();
            const currentWonder = allianceData.allianceWonder;
            const progress = allianceData.wonderProgress[wonderId] || { wood: 0, stone: 0, silver: 0 };
            const nextLevel = currentWonder.level + 1;
            const cost = getWonderCost(nextLevel);

            if (progress.wood < cost.wood || progress.stone < cost.stone || progress.silver < cost.silver) {
                throw new Error("Not enough resources have been donated to claim this level.");
            }

            transaction.update(allianceDocRef, {
                allianceWonder: { id: wonderId, level: nextLevel },
                wonderProgress: { [wonderId]: { wood: 0, stone: 0, silver: 0 } } // Reset progress for next level
            });
        });
    };

    const demolishWonder = async () => {
         if (!playerAlliance) throw new Error("You are not in an alliance.");
         if (playerAlliance.leader.uid !== currentUser.uid) throw new Error("Only the leader can demolish the wonder.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!allianceDoc.exists()) throw new Error("Alliance data not found.");

            transaction.update(allianceDocRef, { allianceWonder: null });
        });
    };

    return { donateToWonder, claimWonderLevel, demolishWonder };
};
