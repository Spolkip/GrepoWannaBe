// src/contexts/GameContext.js

import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot,deleteDoc, collection, runTransaction, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children, worldId }) => {
    const { currentUser, userProfile } = useAuth();
    const [gameState, setGameState] = useState(null);
    const [worldState, setWorldState] = useState(null);
    const [playerCity, setPlayerCity] = useState(null);
    const [playerHasChosenFaction, setPlayerHasChosenFaction] = useState(false);
    const [loading, setLoading] = useState(true);
    const [playerGod, setPlayerGod] = useState(null);
    const [playerAlliance, setPlayerAlliance] = useState(null);
    const [conqueredVillages, setConqueredVillages] = useState({});
    const [conqueredRuins, setConqueredRuins] = useState({}); // #comment Add state for conquered ruins
    const [gameSettings, setGameSettings] = useState({
        animations: true,
        confirmActions: true,
        showGrid: true,
        showVisuals: true,
    });

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
                    members: [{ uid: currentUser.uid, username: userProfile.username, rank: 'leader' }],
                    research: {},
                    diplomacy: { allies: [], enemies: [] }
                };

                transaction.set(allianceDocRef, newAlliance);
                transaction.update(gameDocRef, { alliance: allianceId });
            });

            console.log("Alliance created successfully");
        } catch (error) {
            console.error("Error creating alliance: ", error);
            alert("Failed to create alliance: " + error.message);
        }
    };
    
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

                // Check if player has enough resources
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

    // #comment sends an alliance invitation message to a player
    const sendAllianceInvitation = async (targetUserId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            alert("Only the alliance leader can send invitations.");
            return;
        }
        if (!targetUserId) {
            alert("Invalid target player.");
            return;
        }
    
        try {
            const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
            const targetUsername = targetUserDoc.exists() ? targetUserDoc.data().username : 'Unknown Player';

            // Add event to alliance log
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
    
            alert("Invitation sent!");
    
        } catch (error) {
            console.error("Error sending invitation:", error);
            alert("Failed to send invitation.");
        }
    };

    // #comment handles a player accepting an alliance invitation
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
    
                // If player is in another alliance, remove them from it
                if (oldAllianceId) {
                    const oldAllianceDocRef = doc(db, 'worlds', worldId, 'alliances', oldAllianceId);
                    const oldAllianceDoc = await transaction.get(oldAllianceDocRef);
                    if (oldAllianceDoc.exists()) {
                        const oldAllianceData = oldAllianceDoc.data();
                        const updatedMembers = oldAllianceData.members.filter(m => m.uid !== currentUser.uid);
                        transaction.update(oldAllianceDocRef, { members: updatedMembers });
    
                        // Add event to old alliance
                        const oldAllianceEventsRef = doc(collection(db, 'worlds', worldId, 'alliances', oldAllianceId, 'events'));
                        transaction.set(oldAllianceEventsRef, {
                            type: 'member_left',
                            text: `${userProfile.username} has left the alliance to join ${newAllianceData.name}.`,
                            timestamp: serverTimestamp(),
                        });
                    }
                }
    
                // Add player to the new alliance
                const newMembers = [...newAllianceData.members, { uid: currentUser.uid, username: userProfile.username, rank: 'member' }];
                transaction.update(newAllianceDocRef, { members: newMembers });
    
                // Update player's game data
                transaction.update(gameDocRef, { alliance: allianceId });
    
                // Add event to new alliance
                const newAllianceEventsRef = doc(collection(db, 'worlds', worldId, 'alliances', allianceId, 'events'));
                transaction.set(newAllianceEventsRef, {
                    type: 'member_joined',
                    text: `${userProfile.username} has joined the alliance.`,
                    timestamp: serverTimestamp(),
                });
            });
            alert(`You have joined the alliance "${allianceId}"!`);
        } catch (error) {
            console.error("Error accepting invitation:", error);
            alert(`Failed to join alliance: ${error.message}`);
        }
    };

    useEffect(() => {
        if (!currentUser || !worldId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        let playerStateLoaded = false;
        let worldMetaLoaded = false;
        let playerCityLoaded = false;
        let cityListenerUnsubscribe = () => {};
        let conqueredVillagesUnsubscribe = () => {};
        let conqueredRuinsUnsubscribe = () => {}; // #comment Unsubscribe for ruins
        let allianceListenerUnsubscribe = () => {};


        const checkAllLoaded = () => {
            if (playerStateLoaded && worldMetaLoaded && playerCityLoaded) {
                setLoading(false);
            }
        };

        const worldDocRef = doc(db, 'worlds', worldId);
        const unsubscribeWorldMeta = onSnapshot(worldDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setWorldState({ id: docSnap.id, ...docSnap.data() });
            } else {
                setWorldState(null);
            }
            worldMetaLoaded = true;
            checkAllLoaded();
        }, (error) => {
            console.error("Error fetching world metadata:", error);
            worldMetaLoaded = true;
            checkAllLoaded();
        });
        
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const unsubscribePlayer = onSnapshot(gameDocRef, async (docSnap) => {
            cityListenerUnsubscribe();
            conqueredVillagesUnsubscribe();
            conqueredRuinsUnsubscribe(); // #comment Unsubscribe for ruins
            allianceListenerUnsubscribe();

            if (docSnap.exists() && docSnap.data().playerInfo) {
                const gameData = docSnap.data();
                setGameState(gameData);
                setPlayerHasChosenFaction(true);
                setPlayerGod(gameData.god || null);

                if (gameData.alliance) {
                    const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', gameData.alliance);
                    allianceListenerUnsubscribe = onSnapshot(allianceDocRef, (allianceSnap) => {
                        if(allianceSnap.exists()) {
                            setPlayerAlliance({id: allianceSnap.id, ...allianceSnap.data()});
                        } else {
                            setPlayerAlliance(null);
                        }
                    });
                } else {
                    setPlayerAlliance(null);
                }

                const citySlotId = gameData.cityLocation?.slotId;

                const conqueredVillagesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages');
                conqueredVillagesUnsubscribe = onSnapshot(conqueredVillagesRef, (snapshot) => {
                    const villagesData = {};
                    snapshot.docs.forEach(doc => {
                        villagesData[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    setConqueredVillages(villagesData);
                });

                // #comment Listener for conquered ruins
                const conqueredRuinsRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredRuins');
                conqueredRuinsUnsubscribe = onSnapshot(conqueredRuinsRef, (snapshot) => {
                    const ruinsData = {};
                    snapshot.docs.forEach(doc => {
                        ruinsData[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    setConqueredRuins(ruinsData);
                });


                if (citySlotId) {
                    const cityDocRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
                    cityListenerUnsubscribe = onSnapshot(cityDocRef, (cityDataSnap) => {
                        if (cityDataSnap.exists()) {
                            setPlayerCity({ id: cityDataSnap.id, ...cityDataSnap.data() });
                        }
                        playerCityLoaded = true;
                        checkAllLoaded();
                    });
                } else {
                     console.warn("Malformed game data detected. Deleting and forcing re-selection.");
                     await deleteDoc(gameDocRef);
                }
            } else {
                setGameState(null);
                setPlayerCity(null);
                setPlayerHasChosenFaction(false);
                setPlayerGod(null);
                setPlayerAlliance(null);
                setConqueredVillages({});
                setConqueredRuins({}); // #comment Reset conquered ruins
                playerCityLoaded = true; 
            }
            playerStateLoaded = true;
            checkAllLoaded();
        }, (error) => {
            console.error("Error fetching player game state:", error);
            playerStateLoaded = true;
            playerCityLoaded = true;
            checkAllLoaded();
        });

        return () => {
            unsubscribePlayer();
            unsubscribeWorldMeta();
            cityListenerUnsubscribe();
            conqueredVillagesUnsubscribe();
            conqueredRuinsUnsubscribe(); // #comment Unsubscribe for ruins
            allianceListenerUnsubscribe();
        };
    }, [currentUser, worldId]);

    const value = { 
        gameState, setGameState, 
        worldState, 
        playerCity, 
        playerHasChosenFaction, 
        loading, 
        worldId, 
        playerGod, setPlayerGod, 
        playerAlliance, setPlayerAlliance, 
        conqueredVillages, 
        conqueredRuins, // #comment Provide conquered ruins in context
        donateToAllianceResearch, 
        createAlliance,
        gameSettings, setGameSettings,
        sendAllianceInvitation,
        acceptAllianceInvitation
    };
    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
