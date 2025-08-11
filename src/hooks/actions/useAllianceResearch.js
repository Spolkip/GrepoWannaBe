import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import allianceResearch from '../../gameData/allianceResearch.json';

export const useAllianceResearchActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState } = useGame();

    const donateToAllianceResearch = async (researchId, donation) => {
        if (!playerAlliance) {
            alert("You are not in an alliance.");
            return;
        }


        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', gameState.id);
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                const allianceDoc = await transaction.get(allianceDocRef);

                if (!cityDoc.exists() || !allianceDoc.exists()) {
                    throw new Error("City or Alliance data not found.");
                }

                const cityData = cityDoc.data();
                const allianceData = allianceDoc.data();

                for (const resource in donation) {
                    if ((cityData.resources[resource] || 0) < donation[resource]) {
                        throw new Error(`Not enough ${resource}.`);
                    }
                }

                const research = allianceData.research[researchId] || { level: 0, progress: { wood: 0, stone: 0, silver: 0 }};
                const newPlayerResources = { ...cityData.resources };
                const newResearchProgress = { ...research.progress };

                for (const resource in donation) {
                    newPlayerResources[resource] -= donation[resource];
                    newResearchProgress[resource] = (newResearchProgress[resource] || 0) + donation[resource];
                }

                transaction.update(cityDocRef, { resources: newPlayerResources });
                transaction.update(allianceDocRef, { [`research.${researchId}.progress`]: newResearchProgress });
            });
            alert("Donation successful!");
        } catch (error) {
            alert(`Donation failed: ${error.message}`);
            console.error("Donation error:", error);
        }
    };

    const recommendAllianceResearch = async (researchId) => {
        if (!playerAlliance || !currentUser || !userProfile) return;

        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) throw new Error("You are not a member of this alliance.");

        const rank = playerAlliance.ranks.find(r => r.id === member.rank);
        if (!rank || !rank.permissions.recommendResearch) {
            throw new Error("You do not have permission to recommend research.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const eventsRef = collection(allianceRef, 'events');

        try {
            await runTransaction(db, async (transaction) => {
                transaction.update(allianceRef, { recommendedResearch: researchId });
                const researchName = allianceResearch[researchId]?.name || 'a research';
                transaction.set(doc(eventsRef), {
                    type: 'research_recommendation',
                    text: `${userProfile.username} has recommended focusing on ${researchName}.`,
                    timestamp: serverTimestamp(),
                });
            });
        } catch (error) {
            console.error("Error recommending research:", error);
            throw error;
        }
    };

    return { donateToAllianceResearch, recommendAllianceResearch };
};
