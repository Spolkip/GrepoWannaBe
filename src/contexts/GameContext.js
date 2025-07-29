// src/contexts/GameContext.js

import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot, getDoc, deleteDoc } from "firebase/firestore";
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
    const [playerAlliance, setPlayerAlliance] = useState(null); // Added alliance state

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
            cityListenerUnsubscribe();

            if (docSnap.exists() && docSnap.data().playerInfo) {
                const gameData = docSnap.data();
                const citySlotId = gameData.cityLocation?.slotId;

                if (citySlotId) {
                    const cityDocRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
                    const citySnap = await getDoc(cityDocRef);

                    if (citySnap.exists() && citySnap.data().ownerId === currentUser.uid) {
                        setGameState(gameData);
                        setPlayerHasChosenFaction(true);
                        setPlayerGod(gameData.god || null);
                        setPlayerAlliance(gameData.alliance || null); // Set alliance from game data

                        cityListenerUnsubscribe = onSnapshot(cityDocRef, (cityDataSnap) => {
                            if (cityDataSnap.exists()) {
                                setPlayerCity({ id: cityDataSnap.id, ...cityDataSnap.data() });
                            }
                            playerCityLoaded = true;
                            checkAllLoaded();
                        });
                    } else {
                        console.warn("Stale game data detected. Deleting and forcing re-selection.");
                        await deleteDoc(gameDocRef);
                    }
                } else {
                     console.warn("Malformed game data detected. Deleting and forcing re-selection.");
                     await deleteDoc(gameDocRef);
                }
            } else {
                setGameState(null);
                setPlayerCity(null);
                setPlayerHasChosenFaction(false);
                setPlayerGod(null);
                setPlayerAlliance(null); // Reset alliance
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

    const value = { gameState, setGameState, worldState, playerCity, playerHasChosenFaction, loading, worldId, playerGod, setPlayerGod, playerAlliance, setPlayerAlliance };
    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
