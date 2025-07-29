// src/contexts/GameContext.js

import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot, getDoc, deleteDoc } from "firebase/firestore"; // Add getDoc and deleteDoc
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children, worldId }) => {
    const { currentUser } = useAuth();
    const [gameState, setGameState] = useState(null);
    const [worldState, setWorldState] = useState(null);
    const [playerCity, setPlayerCity] = useState(null);
    const [playerHasChosenFaction, setPlayerHasChosenFaction] = useState(false);
    const [loading, setLoading] = useState(true);
    const [playerGod, setPlayerGod] = useState(null);

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
            cityListenerUnsubscribe(); // Clear any previous listener

            if (docSnap.exists() && docSnap.data().playerInfo) {
                const gameData = docSnap.data();
                const citySlotId = gameData.cityLocation?.slotId;

                if (citySlotId) {
                    const cityDocRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
                    const citySnap = await getDoc(cityDocRef);

                    // Check if the city slot from the player's game data actually exists in the current world
                    if (citySnap.exists() && citySnap.data().ownerId === currentUser.uid) {
                        // Game state is valid, proceed normally
                        setGameState(gameData);
                        setPlayerHasChosenFaction(true);
                        setPlayerGod(gameData.god || null);

                        cityListenerUnsubscribe = onSnapshot(cityDocRef, (cityDataSnap) => {
                            if (cityDataSnap.exists()) {
                                setPlayerCity({ id: cityDataSnap.id, ...cityDataSnap.data() });
                            }
                            playerCityLoaded = true;
                            checkAllLoaded();
                        });
                    } else {
                        // Stale game data found (e.g., from a deleted world). Clean it up.
                        console.warn("Stale game data detected. Deleting and forcing re-selection.");
                        await deleteDoc(gameDocRef); // This will re-trigger the snapshot with docSnap.exists() as false
                    }
                } else {
                     // Malformed game data (missing location). Clean it up.
                     console.warn("Malformed game data detected. Deleting and forcing re-selection.");
                     await deleteDoc(gameDocRef);
                }
            } else {
                // No valid game data for this user in this world, treat as a new player.
                setGameState(null);
                setPlayerCity(null);
                setPlayerHasChosenFaction(false);
                setPlayerGod(null);
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
        };
    }, [currentUser, worldId]);

    const value = { gameState, setGameState, worldState, playerCity, playerHasChosenFaction, loading, worldId, playerGod, setPlayerGod };
    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};