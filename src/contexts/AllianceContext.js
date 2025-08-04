import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot,deleteDoc, collection, runTransaction, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp, setDoc, arrayUnion, arrayRemove, writeBatch } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import allianceResearch from '../gameData/allianceResearch.json';

const AllianceContext = createContext();

export const useAlliance = () => useContext(AllianceContext);

export const AllianceProvider = ({ children }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState } = useGame();
    const [playerAlliance, setPlayerAlliance] = useState(null);

    useEffect(() => {
        if (!worldId || !gameState || !gameState.alliance) {
            setPlayerAlliance(null);
            return;
        }

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', gameState.alliance);
        const unsubscribe = onSnapshot(allianceDocRef, (allianceSnap) => {
            if (allianceSnap.exists()) {
                setPlayerAlliance({ id: allianceSnap.id, ...allianceSnap.data() });
            } else {
                setPlayerAlliance(null);
            }
        });

        return () => unsubscribe();
    }, [worldId, gameState]);

    // create a new alliance
    const createAlliance = async (name, tag) => {
        if (!currentUser || !worldId || !userProfile) return;

        const allianceId = tag.toUpperCase();
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        try {
            await runTransaction(db, async (transaction) => {
                const allianceDoc = await transaction.get(allianceDocRef);
                if (allianceDoc.exists()) {
                    throw new Error("An alliance with this tag already exists.");
                }

                const gameDoc = await transaction.get(gameDocRef);
                if (!gameDoc.exists()) {
                    throw new Error("Player game data not found.");
                }

                const playerData = gameDoc.data();
                if (playerData.alliance) {
                    throw new Error("You are already in an alliance.");
                }

                const newAlliance = {
                    name,
                    tag: allianceId,
                    leader: { uid: currentUser.uid, username: userProfile.username },
                    members: [{ uid: currentUser.uid, username: userProfile.username, rank: 'Leader' }],
                    research: {},
                    diplomacy: { allies: [], enemies: [], requests: [] },
                    settings: {
                        status: 'open',
                        description: `A new alliance, '${name}', has been formed!`,
                    },
                    ranks: [
                        { id: 'Leader', name: 'Leader', permissions: {
                            manageRanks: true, manageSettings: true, manageDiplomacy: true, inviteMembers: true, kickMembers: true, recommendResearch: true
                        }},
                        { id: 'Member', name: 'Member', permissions: {
                            manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, recommendResearch: false
                        }}
                    ],
                    applications: [],
                };

                transaction.set(allianceDocRef, newAlliance);
                transaction.update(gameDocRef, { alliance: allianceId });
                
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', playerData.cityLocation.slotId);
                transaction.update(citySlotRef, { alliance: allianceId, allianceName: name });
            });
        } catch (error) {
            console.error("Error creating alliance: ", error);
            alert("Failed to create alliance: " + error.message);
        }
    };
    
    // donate resources to alliance research
    const donateToAllianceResearch = async (researchId, donation) => {
        if (!playerAlliance) {
            alert("You are not in an alliance.");
            return;
        }

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);

        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameDocRef);
                const allianceDoc = await transaction.get(allianceDocRef);

                if (!gameDoc.exists() || !allianceDoc.exists()) {
                    throw new Error("Game or Alliance data not found.");
                }

                const playerData = gameDoc.data();
                const allianceData = allianceDoc.data();

                for (const resource in donation) {
                    if ((playerData.resources[resource] || 0) < donation[resource]) {
                        throw new Error(`Not enough ${resource}.`);
                    }
                }
                
                const research = allianceData.research[researchId] || { level: 0, progress: { wood: 0, stone: 0, silver: 0 }};
                const newPlayerResources = { ...playerData.resources };
                const newResearchProgress = { ...research.progress };

                for (const resource in donation) {
                    newPlayerResources[resource] -= donation[resource];
                    newResearchProgress[resource] = (newResearchProgress[resource] || 0) + donation[resource];
                }

                transaction.update(gameDocRef, { resources: newPlayerResources });
                transaction.update(allianceDocRef, { [`research.${researchId}.progress`]: newResearchProgress });
            });
            alert("Donation successful!");
        } catch (error) {
            alert(`Donation failed: ${error.message}`);
            console.error("Donation error:", error);
        }
    };

    // recommend a research for the alliance to focus on
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

    // update general alliance settings like description and status
    const updateAllianceSettings = async (settings) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            return;
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        await updateDoc(allianceDocRef, { settings });
    };

    // send an invitation to another player to join the alliance
    const sendAllianceInvitation = async (targetUserId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            return;
        }
        if (!targetUserId) {
            return;
        }
    
        try {
            const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
            const targetUsername = targetUserDoc.exists() ? targetUserDoc.data().username : 'Unknown Player';

            const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
            await addDoc(allianceEventsRef, {
                type: 'invitation_sent',
                text: `${userProfile.username} invited ${targetUsername} to the alliance.`,
                timestamp: serverTimestamp(),
            });

            const messageText = `You have been invited to join the alliance "${playerAlliance.name}".\n\n[action=accept_invite,allianceId=${playerAlliance.id}]Accept Invitation[/action]\n[action=decline_invite,allianceId=${playerAlliance.id}]Decline Invitation[/action]`;
    
            const conversationQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', '==', [currentUser.uid, targetUserId].sort())
            );
            const conversationSnapshot = await getDocs(conversationQuery);
    
            let conversationRef;
            if (conversationSnapshot.empty) {
                conversationRef = doc(collection(db, 'worlds', worldId, 'conversations'));
                await setDoc(conversationRef, {
                    participants: [currentUser.uid, targetUserId].sort(),
                    participantUsernames: {
                        [currentUser.uid]: userProfile.username,
                        [targetUserId]: targetUsername,
                    },
                    lastMessage: { text: "Alliance Invitation", senderId: 'system', timestamp: serverTimestamp() },
                    readBy: [],
                });
            } else {
                conversationRef = conversationSnapshot.docs[0].ref;
            }
    
            await addDoc(collection(conversationRef, 'messages'), {
                text: messageText,
                senderId: 'system',
                senderUsername: 'System',
                isSystem: true,
                timestamp: serverTimestamp(),
            });
    
            await updateDoc(conversationRef, {
                lastMessage: { text: "Alliance Invitation Sent", senderId: 'system', timestamp: serverTimestamp() },
                readBy: [],
            });
    
        } catch (error) {
            console.error("Error sending invitation:", error);
        }
    };

    // revoke a pending alliance invitation
    const revokeAllianceInvitation = async (invitedUserId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            return;
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const invitesRef = collection(allianceDocRef, 'invitations');
        const q = query(invitesRef, where('invitedUserId', '==', invitedUserId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            await deleteDoc(snapshot.docs[0].ref);
        }
    };

    // accept an invitation to join an alliance
    const acceptAllianceInvitation = async (allianceId) => {
        if (!currentUser || !worldId) return;
    
        const newAllianceDocRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
    
        try {
            await runTransaction(db, async (transaction) => {
                const newAllianceDoc = await transaction.get(newAllianceDocRef);
                const gameDoc = await transaction.get(gameDocRef);
    
                if (!newAllianceDoc.exists()) throw new Error("Alliance no longer exists.");
                if (!gameDoc.exists()) throw new Error("Your game data was not found.");
    
                const newAllianceData = newAllianceDoc.data();
                const gameData = gameDoc.data();
                const oldAllianceId = gameData.alliance;
    
                if (oldAllianceId === allianceId) throw new Error("You are already in this alliance.");
    
                if (oldAllianceId) {
                    const oldAllianceDocRef = doc(db, 'worlds', worldId, 'alliances', oldAllianceId);
                    const oldAllianceDoc = await transaction.get(oldAllianceDocRef);
                    if (oldAllianceDoc.exists()) {
                        const oldAllianceData = oldAllianceDoc.data();
                        const updatedMembers = oldAllianceData.members.filter(m => m.uid !== currentUser.uid);
                        transaction.update(oldAllianceDocRef, { members: updatedMembers });
    
                        const oldAllianceEventsRef = doc(collection(db, 'worlds', worldId, 'alliances', oldAllianceId, 'events'));
                        transaction.set(oldAllianceEventsRef, {
                            type: 'member_left',
                            text: `${userProfile.username} has left the alliance to join ${newAllianceData.name}.`,
                            timestamp: serverTimestamp(),
                        });
                    }
                }
    
                const newMembers = [...newAllianceData.members, { uid: currentUser.uid, username: userProfile.username, rank: 'Member' }];
                transaction.update(newAllianceDocRef, { members: newMembers });
                transaction.update(gameDocRef, { alliance: allianceId });
    
                const newAllianceEventsRef = doc(collection(db, 'worlds', worldId, 'alliances', allianceId, 'events'));
                transaction.set(newAllianceEventsRef, {
                    type: 'member_joined',
                    text: `${userProfile.username} has joined the alliance.`,
                    timestamp: serverTimestamp(),
                });
                
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameData.cityLocation.slotId);
                transaction.update(citySlotRef, { alliance: allianceId, allianceName: newAllianceData.name });
            });
        } catch (error) {
            console.error("Error accepting invitation:", error);
            alert(`Failed to join alliance: ${error.message}`);
        }
    };
    
    // create a new rank within the alliance
    const createAllianceRank = async (rank) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) return;

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const newRanks = [...playerAlliance.ranks, rank];
        await updateDoc(allianceDocRef, { ranks: newRanks });
    };

    // update a member's rank
    const updateAllianceMemberRank = async (memberId, newRankId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) return;
        
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const updatedMembers = playerAlliance.members.map(member =>
            member.uid === memberId ? { ...member, rank: newRankId } : member
        );
        await updateDoc(allianceDocRef, { members: updatedMembers });
    };

    // apply to join an invite-only alliance
    const applyToAlliance = async (allianceId) => {
        if (!currentUser || !worldId || !userProfile) {
            throw new Error("User or world not identified.");
        }
        if (playerAlliance) {
            throw new Error("You are already in an alliance.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        await updateDoc(allianceRef, {
            applications: arrayUnion({
                userId: currentUser.uid,
                username: userProfile.username,
                timestamp: new Date()
            })
        });
    };

    // send an ally request to another alliance
    const sendAllyRequest = async (targetAllianceId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        if (playerAlliance.tag.toUpperCase() === targetAllianceId.toUpperCase()) {
            throw new Error("You cannot send an ally request to your own alliance.");
        }
        if (playerAlliance.diplomacy?.allies?.some(a => a.id === targetAllianceId)) {
            throw new Error("You are already allied with this alliance.");
        }
        if (playerAlliance.diplomacy?.enemies?.some(e => e.id === targetAllianceId)) {
            throw new Error("You cannot send an ally request to an enemy.");
        }
        const targetAllianceRef = doc(db, 'worlds', worldId, 'alliances', targetAllianceId);
        await updateDoc(targetAllianceRef, {
            'diplomacy.requests': arrayUnion({
                id: playerAlliance.id,
                name: playerAlliance.name,
                tag: playerAlliance.tag
            })
        });
        const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(allianceEventsRef, {
            type: 'diplomacy',
            text: `An ally request was sent to [${targetAllianceId}].`,
            timestamp: serverTimestamp(),
        });
    };

    // declare another alliance as an enemy
    const declareEnemy = async (targetAllianceId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        if (playerAlliance.diplomacy?.allies?.some(a => a.id === targetAllianceId)) {
            throw new Error("You cannot declare an ally as an enemy.");
        }
        if (playerAlliance.diplomacy?.enemies?.some(e => e.id === targetAllianceId)) {
            throw new Error("This alliance is already an enemy.");
        }
        const ownAllianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const targetAllianceDoc = await getDoc(doc(db, 'worlds', worldId, 'alliances', targetAllianceId));
        if (!targetAllianceDoc.exists()) {
            throw new Error("Target alliance not found.");
        }
        const targetData = targetAllianceDoc.data();
        await updateDoc(ownAllianceRef, {
            'diplomacy.enemies': arrayUnion({
                id: targetAllianceId,
                name: targetData.name,
                tag: targetData.tag
            })
        });
        const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(allianceEventsRef, {
            type: 'diplomacy',
            text: `[${targetAllianceId}] has been declared an enemy.`,
            timestamp: serverTimestamp(),
        });
    };

    // handle responses to diplomatic requests (accept, reject, remove)
    const handleDiplomacyResponse = async (targetAllianceId, action) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const ownAllianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const targetAllianceRef = doc(db, 'worlds', worldId, 'alliances', targetAllianceId);
    
        const ownEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        const targetEventsRef = collection(db, 'worlds', worldId, 'alliances', targetAllianceId, 'events');
    
        await runTransaction(db, async (transaction) => {
            const ownAllianceDoc = await transaction.get(ownAllianceRef);
            const targetAllianceDoc = await transaction.get(targetAllianceRef);
    
            if (!ownAllianceDoc.exists()) throw new Error("Your alliance data not found.");
            if (!targetAllianceDoc.exists()) throw new Error("Target alliance not found.");
            
            const ownData = ownAllianceDoc.data();
            const targetData = targetAllianceDoc.data();
    
            const targetInfo = { id: targetAllianceId, name: targetData.name, tag: targetData.tag };
            const ownInfo = { id: playerAlliance.id, name: ownData.name, tag: ownData.tag };
    
            const ownDiplomacy = ownData.diplomacy || { allies: [], enemies: [], requests: [] };
            const targetDiplomacy = targetData.diplomacy || { allies: [], enemies: [], requests: [] };
    
            switch(action) {
                case 'accept':
                    transaction.update(ownAllianceRef, { 'diplomacy.requests': arrayRemove(targetInfo), 'diplomacy.allies': arrayUnion(targetInfo) });
                    transaction.update(targetAllianceRef, { 'diplomacy.allies': arrayUnion(ownInfo) });
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `You are now allied with [${targetInfo.tag}].`, timestamp: serverTimestamp() });
                    addDoc(targetEventsRef, { type: 'diplomacy', text: `You are now allied with [${ownInfo.tag}].`, timestamp: serverTimestamp() });
                    break;
                case 'reject':
                    transaction.update(ownAllianceRef, { 'diplomacy.requests': arrayRemove(targetInfo) });
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `You rejected the ally request from [${targetInfo.tag}].`, timestamp: serverTimestamp() });
                    break;
                case 'removeAlly':
                    const allyInOwnList = ownDiplomacy.allies.find(a => a.id === targetAllianceId);
                    const allyInTargetList = targetDiplomacy.allies.find(a => a.id === playerAlliance.id);
    
                    if (allyInOwnList) {
                        transaction.update(ownAllianceRef, { 'diplomacy.allies': arrayRemove(allyInOwnList) });
                    }
                    if (allyInTargetList) {
                        transaction.update(targetAllianceRef, { 'diplomacy.allies': arrayRemove(allyInTargetList) });
                    }
                    
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `The alliance with [${targetInfo.tag}] has been terminated.`, timestamp: serverTimestamp() });
                    addDoc(targetEventsRef, { type: 'diplomacy', text: `The alliance with [${ownInfo.tag}] has been terminated.`, timestamp: serverTimestamp() });
                    break;
                case 'removeEnemy':
                    const enemyInOwnList = ownDiplomacy.enemies.find(e => e.id === targetAllianceId);
                    if (enemyInOwnList) {
                        transaction.update(ownAllianceRef, { 'diplomacy.enemies': arrayRemove(enemyInOwnList) });
                    }
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `You are no longer at war with [${targetInfo.tag}].`, timestamp: serverTimestamp() });
                    break;
                default:
                    throw new Error("Invalid diplomacy action.");
            }
        });
    };

    // leave the current alliance
    const leaveAlliance = async () => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (playerAlliance.leader.uid === currentUser.uid && playerAlliance.members.length > 1) {
            throw new Error("Leaders must pass leadership before leaving.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const gameRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        await runTransaction(db, async (transaction) => {
            const gameData = (await transaction.get(gameRef)).data();
            const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameData.cityLocation.slotId);

            if (playerAlliance.members.length === 1) {
                transaction.delete(allianceRef);
            } else {
                const memberToRemove = playerAlliance.members.find(m => m.uid === currentUser.uid);
                if (memberToRemove) {
                    transaction.update(allianceRef, {
                        members: arrayRemove(memberToRemove)
                    });
                }
            }
            transaction.update(gameRef, { alliance: null });
            transaction.update(citySlotRef, { alliance: null, allianceName: null });
        });
    };

    // permanently disband the alliance
    const disbandAlliance = async () => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You are not the leader of this alliance.");
        }
        
        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const batch = writeBatch(db);

        for (const member of playerAlliance.members) {
            const gameRef = doc(db, `users/${member.uid}/games`, worldId);
            const gameSnap = await getDoc(gameRef);
            if (gameSnap.exists()) {
                const gameData = gameSnap.data();
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameData.cityLocation.slotId);
                batch.update(gameRef, { alliance: null });
                batch.update(citySlotRef, { alliance: null, allianceName: null });
            }
        }
        batch.delete(allianceRef);
        await batch.commit();
    };

    // join an alliance with 'open' status
    const joinOpenAlliance = async (allianceId) => {
        if (!currentUser || !worldId || !userProfile) throw new Error("User or world not identified.");
        if (playerAlliance) throw new Error("You are already in an alliance.");

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceRef);
            const gameDoc = await transaction.get(gameRef);
            if (!allianceDoc.exists()) throw new Error("Alliance not found.");
            if (!gameDoc.exists()) throw new Error("Your game data not found.");

            const allianceData = allianceDoc.data();
            const gameData = gameDoc.data();

            if (allianceData.settings.status !== 'open') throw new Error("This alliance is not open for joining.");

            transaction.update(allianceRef, {
                members: arrayUnion({ uid: currentUser.uid, username: userProfile.username, rank: 'Member' })
            });
            transaction.update(gameRef, { alliance: allianceId });

            const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameData.cityLocation.slotId);
            transaction.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });
        });
    };

    // handle a player's application to the alliance
    const handleApplication = async (application, allianceId, action) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const applicantGameRef = doc(db, `users/${application.userId}/games`, worldId);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceRef);
            const applicantGameDoc = await transaction.get(applicantGameRef);
            if (!allianceDoc.exists() || !applicantGameDoc.exists()) throw new Error("Data not found.");

            const allianceData = allianceDoc.data();
            const applicantGameData = applicantGameDoc.data();

            const appToRemove = allianceData.applications.find(app => app.userId === application.userId);
            if (appToRemove) {
                transaction.update(allianceRef, { applications: arrayRemove(appToRemove) });
            }

            if (action === 'accept') {
                transaction.update(allianceRef, {
                    members: arrayUnion({ uid: application.userId, username: application.username, rank: 'Member' })
                });
                transaction.update(applicantGameRef, { alliance: allianceId });
                
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', applicantGameData.cityLocation.slotId);
                transaction.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });
            }
        });
    };

    const value = {
        playerAlliance,
        createAlliance,
        donateToAllianceResearch,
        recommendAllianceResearch,
        updateAllianceSettings,
        sendAllianceInvitation,
        revokeAllianceInvitation,
        acceptAllianceInvitation,
        createAllianceRank,
        updateAllianceMemberRank,
        applyToAlliance,
        sendAllyRequest,
        declareEnemy,
        handleDiplomacyResponse,
        leaveAlliance,
        disbandAlliance,
        joinOpenAlliance,
        handleApplication,
    };
    
    return <AllianceContext.Provider value={value}>{children}</AllianceContext.Provider>;
};