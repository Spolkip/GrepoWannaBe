// src/contexts/GameContext.js

import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot, deleteDoc, collection, runTransaction } from "firebase/firestore";
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
            allianceListenerUnsubscribe();
        };
    }, [currentUser, worldId]);

    const value = { gameState, setGameState, worldState, playerCity, playerHasChosenFaction, loading, worldId, playerGod, setPlayerGod, playerAlliance, setPlayerAlliance, conqueredVillages, donateToAllianceResearch, createAlliance };
    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
