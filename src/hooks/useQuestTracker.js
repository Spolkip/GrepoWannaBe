// src/hooks/useQuestTracker.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; // Import useGame
import allQuests from '../gameData/quests.json';

export const useQuestTracker = (cityState) => {
    const { currentUser } = useAuth();
    const { worldId, activeCityId } = useGame(); // Get worldId and activeCityId from context
    const [questProgress, setQuestProgress] = useState(null);
    const [quests, setQuests] = useState([]);

    // Fetch quest progress from Firestore on load and listen for changes
    useEffect(() => {
        if (!currentUser || !worldId) return;

        const questDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/quests`, 'progress');
        const unsubscribe = onSnapshot(questDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setQuestProgress(docSnap.data());
            } else {
                // Initialize if it doesn't exist
                const initialProgress = { completed: {}, claimed: {} };
                setDoc(questDocRef, initialProgress).then(() => {
                    setQuestProgress(initialProgress);
                });
            }
        });

        return () => unsubscribe();
    }, [currentUser, worldId]);

    // Update quest status when cityState or progress changes
    useEffect(() => {
        if (!cityState || !questProgress) {
            setQuests([]);
            return;
        }

        const updatedQuests = Object.entries(allQuests).map(([id, questData]) => {
            let isComplete = false;
            if (questProgress.completed[id]) {
                isComplete = true;
            } else {
                switch (questData.type) {
                    case 'building':
                        if (cityState.buildings[questData.targetId]?.level >= questData.targetLevel) {
                            isComplete = true;
                        }
                        break;
                    case 'units':
                        const totalUnits = Object.values(cityState.units).reduce((sum, count) => sum + count, 0);
                        if (totalUnits >= questData.targetCount) {
                            isComplete = true;
                        }
                        break;
                    default:
                        break;
                }
            }

            return {
                id,
                ...questData,
                isComplete,
                isClaimed: !!questProgress.claimed[id],
            };
        });

        setQuests(updatedQuests);

    }, [cityState, questProgress]);

    const claimReward = useCallback(async (questId) => {
        if (!currentUser || !worldId || !activeCityId) return;

        const quest = quests.find(q => q.id === questId);
        if (!quest || !quest.isComplete || quest.isClaimed) {
            console.error("Quest not available for claiming.");
            return;
        }

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const questDocRef = doc(db, `users/${currentUser.uid}/games/${worldId}/quests`, 'progress');

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                const questDoc = await transaction.get(questDocRef);

                if (!cityDoc.exists() || !questDoc.exists()) {
                    throw new Error("City or quest data not found.");
                }

                const cityData = cityDoc.data();
                const questData = questDoc.data();

                // Apply rewards
                const newResources = { ...cityData.resources };
                const newUnits = { ...cityData.units };

                if (quest.rewards.resources) {
                    for (const resource in quest.rewards.resources) {
                        newResources[resource] = (newResources[resource] || 0) + quest.rewards.resources[resource];
                    }
                }
                if (quest.rewards.units) {
                    for (const unit in quest.rewards.units) {
                        newUnits[unit] = (newUnits[unit] || 0) + quest.rewards.units[unit];
                    }
                }

                // Update quest progress
                const newQuestProgress = { ...questData };
                newQuestProgress.claimed[questId] = true;
                if (!newQuestProgress.completed[questId]) {
                    newQuestProgress.completed[questId] = true;
                }

                transaction.update(cityDocRef, { resources: newResources, units: newUnits });
                transaction.set(questDocRef, newQuestProgress);
            });
            // The onSnapshot listener will update the local state automatically.
        } catch (error) {
            console.error("Error claiming quest reward:", error);
        }
    }, [currentUser, worldId, activeCityId, quests]);

    return { quests, claimReward };
};
