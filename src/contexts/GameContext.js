// src/contexts/GameContext.js
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { doc, onSnapshot, collection, writeBatch } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children, worldId }) => {
    const { currentUser } = useAuth();
    const [playerGameData, setPlayerGameData] = useState(null); // For top-level game data (like alliance)
    const [playerCities, setPlayerCities] = useState({});
    const [activeCityId, setActiveCityId] = useState(null);
    const [worldState, setWorldState] = useState(null);
    const [playerHasCities, setPlayerHasCities] = useState(false);
    const [loading, setLoading] = useState(true);
    const [conqueredVillages, setConqueredVillages] = useState({});
    const [conqueredRuins, setConqueredRuins] = useState({});
    const [gameSettings, setGameSettings] = useState({
        animations: true,
        confirmActions: true,
        showGrid: true,
        showVisuals: true,
    });

    useEffect(() => {
        if (!currentUser || !worldId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const worldDocRef = doc(db, 'worlds', worldId);
        const unsubscribeWorld = onSnapshot(worldDocRef, (docSnap) => {
            setWorldState(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
        });

        // #comment This listener is for the top-level game document which contains alliance and battle points.
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const unsubscribeGameData = onSnapshot(gameDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setPlayerGameData(docSnap.data());
            } else {
                setPlayerGameData(null);
            }
        });

        const citiesColRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const unsubscribeCities = onSnapshot(citiesColRef, (snapshot) => {
            const citiesData = {};
            snapshot.forEach(doc => {
                citiesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setPlayerCities(citiesData);
            const hasCities = !snapshot.empty;
            setPlayerHasCities(hasCities);

            if (hasCities && !activeCityId) {
                setActiveCityId(snapshot.docs[0].id);
            } else if (!hasCities) {
                setActiveCityId(null);
            }
            setLoading(false);
        });
        
        const conqueredVillagesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredVillages');
        const unsubscribeVillages = onSnapshot(conqueredVillagesRef, (snapshot) => {
            const villagesData = {};
            snapshot.docs.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setConqueredVillages(villagesData);
        });

        const conqueredRuinsRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'conqueredRuins');
        const unsubscribeRuins = onSnapshot(conqueredRuinsRef, (snapshot) => {
            const ruinsData = {};
            snapshot.docs.forEach(doc => {
                ruinsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setConqueredRuins(ruinsData);
        });

        return () => {
            unsubscribeWorld();
            unsubscribeGameData();
            unsubscribeCities();
            unsubscribeVillages();
            unsubscribeRuins();
        };
    }, [currentUser, worldId]);

    const activeCity = playerCities[activeCityId] || null;
    // #comment Legacy properties for components that haven't been updated for multi-city yet.
    const gameState = activeCity; 
    const playerCity = activeCity;

    // #comment Counts the number of cities a player owns on a specific island.
    // #comment This is used to determine resource bonuses from villages.
    const countCitiesOnIsland = useCallback((islandId) => {
        if (!islandId || !playerCities) return 0;
        return Object.values(playerCities).filter(city => city.islandId === islandId).length;
    }, [playerCities]);
    
    // #comment Function to handle renaming a city
    const renameCity = useCallback(async (cityId, newName) => {
        if (!currentUser || !worldId || !cityId || !newName.trim()) {
            throw new Error("Invalid parameters for renaming city.");
        }

        const cityToRename = playerCities[cityId];
        if (!cityToRename) {
            throw new Error("City not found.");
        }

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', cityId);
        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', cityToRename.slotId);

        const batch = writeBatch(db);

        batch.update(cityDocRef, { cityName: newName.trim() });
        batch.update(citySlotRef, { cityName: newName.trim() });

        await batch.commit();
        // The onSnapshot listener will update the local state automatically.

    }, [currentUser, worldId, playerCities]);

    const value = { 
        worldId,
        worldState,
        playerGameData, // Export the top-level player data
        playerCities,
        activeCityId,
        setActiveCityId,
        activeCity,
        playerHasCities,
        loading,
        conqueredVillages,
        conqueredRuins,
        gameSettings,
        setGameSettings,
        countCitiesOnIsland, // #comment Make the function available through the context
        renameCity, // #comment Expose the rename function
        // #comment Legacy support
        gameState,
        playerCity,
        setGameState: (newState) => {
            if (activeCityId) {
                setPlayerCities(prev => ({...prev, [activeCityId]: newState}));
            }
        }
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
