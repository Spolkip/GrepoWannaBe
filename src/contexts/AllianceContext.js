// src/contexts/AllianceContext.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot,deleteDoc, collection, runTransaction, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp, setDoc, arrayUnion, arrayRemove, writeBatch, limit } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import allianceResearch from '../gameData/allianceResearch.json';

const AllianceContext = createContext();

export const useAlliance = () => useContext(AllianceContext);

// #comment Helper function to calculate max members based on research
const calculateMaxMembers = (alliance) => {
    const baseMax = 20; // Base maximum members
    const researchLevel = alliance.research?.expanded_charter?.level || 0;
    const researchBonus = allianceResearch.expanded_charter.effect.value * researchLevel;
    return baseMax + researchBonus;
};

// #comment Helper function to calculate bank capacity
const calculateBankCapacity = (alliance) => {
    const baseCapacity = 100000; // Base capacity for each resource
    const researchLevel = alliance.research?.reinforced_vaults?.level || 0;
    const researchBonus = allianceResearch.reinforced_vaults.effect.value * researchLevel;
    return baseCapacity + researchBonus;
};

export const AllianceProvider = ({ children }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, gameState, playerGameData, activeCityId } = useGame();
    const [playerAlliance, setPlayerAlliance] = useState(null);

    useEffect(() => {
        // #comment The alliance tag is on the top-level game data, not the city-specific game state.
        if (!worldId || !playerGameData || !playerGameData.alliance) {
            setPlayerAlliance(null);
            return;
        }

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerGameData.alliance);
        const unsubscribe = onSnapshot(allianceDocRef, (allianceSnap) => {
            if (allianceSnap.exists()) {
                setPlayerAlliance({ id: allianceSnap.id, ...allianceSnap.data() });
            } else {
                setPlayerAlliance(null);
            }
        });

        return () => unsubscribe();
    }, [worldId, playerGameData]);

    // create a new alliance
    const createAlliance = async (name, tag) => {
        if (!currentUser || !worldId || !userProfile) return;

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);
    
        if (userCitySlotIds.length === 0) {
            alert("You must have a city to create an alliance.");
            return;
        }

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
                    bank: { wood: 0, stone: 0, silver: 0, capacity: 100000 },
                    diplomacy: { allies: [], enemies: [], requests: [] },
                    settings: {
                        status: 'open',
                        description: `A new alliance, '${name}', has been formed!`,
                        privateDescription: '', // #comment Add private description field
                    },
                    ranks: [
                        { id: 'Leader', name: 'Leader', permissions: {
                            manageRanks: true, manageSettings: true, manageDiplomacy: true, inviteMembers: true, kickMembers: true, recommendResearch: true, viewSecretForums: true, manageBank: true, withdrawFromBank: true, proposeTreaties: true, viewMemberActivity: true
                        }},
                        { id: 'Member', name: 'Member', permissions: {
                            manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, recommendResearch: false, viewSecretForums: false, manageBank: false, withdrawFromBank: false, proposeTreaties: false, viewMemberActivity: false
                        }}
                    ],
                    applications: [],
                };

                transaction.set(allianceDocRef, newAlliance);
                transaction.update(gameDocRef, { alliance: allianceId });
                
                // #comment Update all of the player's city slots on the map
                for (const slotId of userCitySlotIds) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                    transaction.update(citySlotRef, { alliance: allianceId, allianceName: name });
                }
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

        // #comment This action is city-specific, so we use the active city's document
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
            throw new Error("You do not have permission to send invitations.");
        }
        if (!targetUserId) {
            throw new Error("Target user ID is not specified.");
        }
    
        try {
            const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
            if (!targetUserDoc.exists()) {
                throw new Error("Target user not found.");
            }
            const targetUsername = targetUserDoc.data().username;

            // #comment Check if an invitation already exists
            const invitesRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'invitations');
            const q = query(invitesRef, where('invitedUserId', '==', targetUserId));
            const existingInviteSnap = await getDocs(q);
            if (!existingInviteSnap.empty) {
                throw new Error("An invitation has already been sent to this player.");
            }

            // #comment Add a document to the invitations subcollection for tracking
            await addDoc(invitesRef, {
                invitedUserId: targetUserId,
                invitedUsername: targetUsername,
                sentAt: serverTimestamp(),
                sentBy: userProfile.username
            });

            // #comment Log the invitation in the alliance events
            const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
            await addDoc(allianceEventsRef, {
                type: 'invitation_sent',
                text: `${userProfile.username} invited ${targetUsername} to the alliance.`,
                timestamp: serverTimestamp(),
            });

            // #comment Send a message to the user with actionable links
            const messageText = `You have been invited to join the alliance "${playerAlliance.name}".\n\n[action=accept_invite,allianceId=${playerAlliance.id}]Accept Invitation[/action]\n[action=decline_invite,allianceId=${playerAlliance.id}]Decline Invitation[/action]`;
    
            const conversationQuery = query(
                collection(db, 'worlds', worldId, 'conversations'),
                where('participants', 'in', [[currentUser.uid, targetUserId], [targetUserId, currentUser.uid]])
            );
            const conversationSnapshot = await getDocs(conversationQuery);
    
            let conversationRef;
            if (conversationSnapshot.empty) {
                conversationRef = doc(collection(db, 'worlds', worldId, 'conversations'));
                await setDoc(conversationRef, {
                    participants: [currentUser.uid, targetUserId],
                    participantUsernames: {
                        [currentUser.uid]: userProfile.username,
                        [targetUserId]: targetUsername,
                    },
                    lastMessage: { text: "Alliance Invitation", senderId: 'system', timestamp: serverTimestamp() },
                    readBy: [currentUser.uid], // Mark as read for the sender initially
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
                readBy: [currentUser.uid], // Update readBy for the sender
            });
    
        } catch (error) {
            console.error("Error sending invitation:", error);
            // #comment Re-throw the error so the UI component can catch it and display a message
            throw error;
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
        
        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const inviteDoc = snapshot.docs[0];
                const inviteData = inviteDoc.data();
                const invitedUsername = inviteData.invitedUsername || 'a player';

                // #comment Log the revocation event
                const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
                await addDoc(allianceEventsRef, {
                    type: 'invitation_revoked',
                    text: `${userProfile.username} has revoked the invitation for ${invitedUsername}.`,
                    timestamp: serverTimestamp(),
                });

                // Delete the invitation
                await deleteDoc(inviteDoc.ref);
            }
        } catch (error) {
            console.error("Error revoking invitation:", error);
            throw error; // Re-throw so the UI can catch it
        }
    };

    // accept an invitation to join an alliance
    const acceptAllianceInvitation = async (allianceId) => {
        if (!currentUser || !worldId) return;

        // #comment Check if user is already in an alliance before doing anything
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const gameDocSnap = await getDoc(gameDocRef);
        if (gameDocSnap.exists() && gameDocSnap.data().alliance) {
            alert("You are already in an alliance. Please leave your current alliance before joining a new one.");
            return;
        }
    
        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        const newAllianceDocRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
    
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
                
                // #comment Check if the alliance is full
                const maxMembers = calculateMaxMembers(newAllianceData);
                if (newAllianceData.members.length >= maxMembers) {
                    throw new Error("This alliance is full.");
                }
    
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
                
                for (const slotId of userCitySlotIds) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                    transaction.update(citySlotRef, { alliance: allianceId, allianceName: newAllianceData.name });
                }

                // #comment Delete the pending invitation from the subcollection
                const invitesRef = collection(db, 'worlds', worldId, 'alliances', allianceId, 'invitations');
                const q = query(invitesRef, where('invitedUserId', '==', currentUser.uid));
                const inviteSnapshot = await getDocs(q); // Use getDocs directly, not inside transaction
                if (!inviteSnapshot.empty) {
                    const inviteDocToDelete = inviteSnapshot.docs[0];
                    transaction.delete(inviteDocToDelete.ref);
                }
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
    
    // #comment function to update the order of ranks
    const updateRanksOrder = async (newRanks) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        await updateDoc(allianceDocRef, { ranks: newRanks });
    };

    // #comment function to update a specific rank's details (name and permissions)
    const updateAllianceRank = async (rankId, updatedRankData) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        
        const newRanks = playerAlliance.ranks.map(rank => 
            rank.id === rankId ? { ...rank, ...updatedRankData, id: updatedRankData.name, name: updatedRankData.name } : rank
        );
    
        // Also update members who have the old rank name
        const updatedMembers = playerAlliance.members.map(member => 
            member.rank === rankId ? { ...member, rank: updatedRankData.name } : member
        );
    
        await updateDoc(allianceDocRef, { ranks: newRanks, members: updatedMembers });
    };

    // #comment function to delete a rank
    const deleteAllianceRank = async (rankId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
    
        // Cannot delete if any member has this rank
        if (playerAlliance.members.some(m => m.rank === rankId)) {
            throw new Error("Cannot delete rank as it is still assigned to members.");
        }
        
        const newRanks = playerAlliance.ranks.filter(rank => rank.id !== rankId);
    
        await updateDoc(allianceDocRef, { ranks: newRanks });
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

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const gameRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        await runTransaction(db, async (transaction) => {
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
            for (const slotId of userCitySlotIds) {
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                transaction.update(citySlotRef, { alliance: null, allianceName: null });
            }
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
            batch.update(gameRef, { alliance: null });

            const citiesRef = collection(db, `users/${member.uid}/games`, worldId, 'cities');
            const citiesSnap = await getDocs(citiesRef);
            citiesSnap.forEach(cityDoc => {
                const cityData = cityDoc.data();
                if (cityData.slotId) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', cityData.slotId);
                    batch.update(citySlotRef, { alliance: null, allianceName: null });
                }
            });
        }
        batch.delete(allianceRef);
        await batch.commit();
    };

    // join an alliance with 'open' status
    const joinOpenAlliance = async (allianceId) => {
        if (!currentUser || !worldId || !userProfile) throw new Error("User or world not identified.");
        if (playerAlliance) throw new Error("You are already in an alliance.");

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceRef);
            if (!allianceDoc.exists()) throw new Error("Alliance not found.");

            const allianceData = allianceDoc.data();
            if (allianceData.settings.status !== 'open') throw new Error("This alliance is not open for joining.");
            
            // #comment Check if the alliance is full
            const maxMembers = calculateMaxMembers(allianceData);
            if (allianceData.members.length >= maxMembers) {
                throw new Error("This alliance is full.");
            }

            transaction.update(allianceRef, {
                members: arrayUnion({ uid: currentUser.uid, username: userProfile.username, rank: 'Member' })
            });
            transaction.update(gameRef, { alliance: allianceId });

            for (const slotId of userCitySlotIds) {
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                transaction.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });
            }
        });
    };

    // handle a player's application to the alliance
    const handleApplication = async (application, allianceId, action) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const applicantGameRef = doc(db, `users/${application.userId}/games`, worldId);

        const citiesRef = collection(db, `users/${application.userId}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceRef);
            if (!allianceDoc.exists()) throw new Error("Data not found.");

            const allianceData = allianceDoc.data();

            const appToRemove = allianceData.applications.find(app => app.userId === application.userId);
            if (appToRemove) {
                transaction.update(allianceRef, { applications: arrayRemove(appToRemove) });
            }

            if (action === 'accept') {
                // #comment Check if the alliance is full before accepting
                const maxMembers = calculateMaxMembers(allianceData);
                if (allianceData.members.length >= maxMembers) {
                    throw new Error("This alliance is full and cannot accept new members.");
                }
                
                transaction.update(allianceRef, {
                    members: arrayUnion({ uid: application.userId, username: application.username, rank: 'Member' })
                });
                transaction.update(applicantGameRef, { alliance: allianceId });
                
                for (const slotId of userCitySlotIds) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                    transaction.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });
                }
            }
        });
    };
    
    // #comment Donate resources to the alliance bank and log the event
    const donateToBank = async (donation) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (Object.values(donation).every(v => v === 0)) throw new Error("Donation amount cannot be zero.");
    
        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const logRef = doc(collection(allianceDocRef, 'bank_logs'));
        const eventRef = doc(collection(allianceDocRef, 'events'));
        const userBankActivityRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'bankActivity', 'activity');

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const allianceDoc = await transaction.get(allianceDocRef);
            const userActivityDoc = await transaction.get(userBankActivityRef);

            if (!cityDoc.exists() || !allianceDoc.exists()) throw new Error("City or Alliance data not found.");
    
            const cityData = cityDoc.data();
            const allianceData = allianceDoc.data();
            const bankCapacity = calculateBankCapacity(allianceData);
            
            const userActivityData = userActivityDoc.exists() ? userActivityDoc.data() : { lastDonation: 0, dailyDonationTotal: 0, lastDonationDate: new Date(0).toISOString().split('T')[0] };
            const now = new Date();
            const today = now.toISOString().split('T')[0];

            if (now.getTime() - (userActivityData.lastDonation || 0) < 5 * 60 * 1000) { // 5 minute cooldown
                const waitTime = Math.ceil((5 * 60 * 1000 - (now.getTime() - userActivityData.lastDonation)) / 1000);
                throw new Error(`You must wait ${waitTime} seconds between donations.`);
            }
            
            let dailyTotal = userActivityData.dailyDonationTotal || 0;
            if(userActivityData.lastDonationDate !== today) {
                dailyTotal = 0;
            }

            const totalDonation = Object.values(donation).reduce((a, b) => a + b, 0);
            if (dailyTotal + totalDonation > 50000) { // 50k daily limit
                throw new Error(`You have reached your daily donation limit of 50,000. You have ${50000 - dailyTotal} left to donate today.`);
            }

            const newCityResources = { ...cityData.resources };
            const newBank = { ...(allianceData.bank || { wood: 0, stone: 0, silver: 0 }) };
    
            for (const resource in donation) {
                if ((newCityResources[resource] || 0) < donation[resource]) throw new Error(`Not enough ${resource}.`);
                if ((newBank[resource] || 0) + donation[resource] > bankCapacity) throw new Error(`Bank is full for ${resource}. Capacity: ${bankCapacity.toLocaleString()}`);
                newCityResources[resource] -= donation[resource];
                newBank[resource] = (newBank[resource] || 0) + donation[resource];
            }
    
            transaction.update(cityDocRef, { resources: newCityResources });
            transaction.update(allianceDocRef, { bank: newBank });
            transaction.set(userBankActivityRef, { 
                lastDonation: now.getTime(), 
                dailyDonationTotal: dailyTotal + totalDonation,
                lastDonationDate: today
            }, { merge: true });

            transaction.set(logRef, {
                type: 'donation',
                user: userProfile.username,
                resources: donation,
                timestamp: serverTimestamp()
            });
    
            const donationAmounts = Object.entries(donation).filter(([,a]) => a > 0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ');
            transaction.set(eventRef, {
                type: 'bank_donation',
                text: `${userProfile.username} donated ${donationAmounts} to the bank.`,
                timestamp: serverTimestamp()
            });
        });
    };

    // #comment Distribute resources from the alliance bank to a member and log the event
    const distributeFromBank = async (targetMemberUid, distribution) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (Object.values(distribution).every(v => v === 0)) throw new Error("Distribution amount cannot be zero.");
    
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const logRef = doc(collection(allianceDocRef, 'bank_logs'));
        const eventRef = doc(collection(allianceDocRef, 'events'));
    
        const targetCitiesRef = collection(db, `users/${targetMemberUid}/games`, worldId, 'cities');
        const q = query(targetCitiesRef, limit(1));
        const targetCitiesSnap = await getDocs(q);
        if (targetCitiesSnap.empty) throw new Error("Target member has no cities in this world.");
        const targetCityDoc = targetCitiesSnap.docs[0];
        const targetCityRef = targetCityDoc.ref;
    
        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceDocRef);
            const targetCitySnap = await transaction.get(targetCityRef);
            if (!allianceDoc.exists() || !targetCitySnap.exists()) throw new Error("Alliance or target city data not found.");
    
            const allianceData = allianceDoc.data();
            const targetCityData = targetCitySnap.data();
            const newBank = { ...(allianceData.bank || { wood: 0, stone: 0, silver: 0 }) };
            const newCityResources = { ...targetCityData.resources };
    
            for (const resource in distribution) {
                if ((newBank[resource] || 0) < distribution[resource]) throw new Error(`Not enough ${resource} in the bank.`);
                newBank[resource] -= distribution[resource];
                newCityResources[resource] = (newCityResources[resource] || 0) + distribution[resource];
            }
    
            transaction.update(allianceDocRef, { bank: newBank });
            transaction.update(targetCityRef, { resources: newCityResources });
    
            const targetUsername = allianceData.members.find(m => m.uid === targetMemberUid)?.username || 'Unknown';
            transaction.set(logRef, {
                type: 'distribution',
                from: userProfile.username,
                to: targetUsername,
                resources: distribution,
                timestamp: serverTimestamp()
            });
    
            const distributionAmounts = Object.entries(distribution).filter(([,a]) => a > 0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ');
            transaction.set(eventRef, {
                type: 'bank_distribution',
                text: `${userProfile.username} distributed ${distributionAmounts} to ${targetUsername}.`,
                timestamp: serverTimestamp()
            });
        });
    };
    
    // #comment Propose a treaty to another alliance
    const proposeTreaty = async (targetAllianceTag, treatyDetails) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");

        const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
        const q = query(alliancesRef, where("tag", "==", targetAllianceTag.toUpperCase()));
        const targetAllianceSnap = await getDocs(q);
        if (targetAllianceSnap.empty) throw new Error("Alliance with that tag not found.");
        const targetAlliance = { id: targetAllianceSnap.docs[0].id, ...targetAllianceSnap.docs[0].data() };
        const targetLeaderId = targetAlliance.leader.uid;
        const targetLeaderUsername = targetAlliance.leader.username;

        const treatyMessage = `Alliance ${playerAlliance.name} [${playerAlliance.tag}] has proposed a treaty to you.\n\nDetails:\n${treatyDetails.message}\n\n[action=view_treaty,treatyId=TEMP]View Treaty[/action]`;

        const conversationQuery = query(
            collection(db, 'worlds', worldId, 'conversations'),
            where('participants', 'in', [[currentUser.uid, targetLeaderId], [targetLeaderId, currentUser.uid]])
        );
        const conversationSnapshot = await getDocs(conversationQuery);

        let conversationRef;
        if (conversationSnapshot.empty) {
            conversationRef = doc(collection(db, 'worlds', worldId, 'conversations'));
            await setDoc(conversationRef, {
                participants: [currentUser.uid, targetLeaderId],
                participantUsernames: {
                    [currentUser.uid]: userProfile.username,
                    [targetLeaderId]: targetLeaderUsername,
                },
                lastMessage: { text: "Treaty Proposal", senderId: 'system', timestamp: serverTimestamp() },
                readBy: [currentUser.uid],
            });
        } else {
            conversationRef = conversationSnapshot.docs[0].ref;
        }

        await addDoc(collection(conversationRef, 'messages'), {
            text: treatyMessage,
            senderId: 'system',
            senderUsername: 'System Diplomat',
            isSystem: true,
            timestamp: serverTimestamp(),
        });

        await updateDoc(conversationRef, {
            lastMessage: { text: "Treaty Proposal Sent", senderId: 'system', timestamp: serverTimestamp() },
            readBy: [currentUser.uid],
        });
    };

    // #comment Withdraw resources from the alliance bank
    const withdrawFromBank = async (withdrawal) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (Object.values(withdrawal).every(v => v === 0)) throw new Error("Withdrawal amount cannot be zero.");

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const logRef = doc(collection(allianceDocRef, 'bank_logs'));

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!cityDoc.exists() || !allianceDoc.exists()) throw new Error("City or Alliance data not found.");

            const cityData = cityDoc.data();
            const allianceData = allianceDoc.data();
            const newCityResources = { ...cityData.resources };
            const newBank = { ...allianceData.bank };

            for (const resource in withdrawal) {
                if (newBank[resource] < withdrawal[resource]) throw new Error(`Not enough ${resource} in the bank.`);
                newBank[resource] -= withdrawal[resource];
                newCityResources[resource] = (newCityResources[resource] || 0) + withdrawal[resource];
            }

            transaction.update(cityDocRef, { resources: newCityResources });
            transaction.update(allianceDocRef, { bank: newBank });
            transaction.set(logRef, {
                type: 'withdrawal',
                user: userProfile.username,
                resources: withdrawal,
                timestamp: serverTimestamp()
            });
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
        updateRanksOrder,
        updateAllianceRank,
        deleteAllianceRank,
        applyToAlliance,
        sendAllyRequest,
        declareEnemy,
        handleDiplomacyResponse,
        leaveAlliance,
        disbandAlliance,
        joinOpenAlliance,
        handleApplication,
        donateToBank,
        distributeFromBank,
        withdrawFromBank,
        proposeTreaty,
    };
    
    return <AllianceContext.Provider value={value}>{children}</AllianceContext.Provider>;
};