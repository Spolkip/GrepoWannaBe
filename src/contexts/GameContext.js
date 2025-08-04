// src/contexts/GameContext.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import { doc, onSnapshot, collection } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children, worldId }) => {
    const { currentUser } = useAuth();
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

        const citiesColRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const unsubscribeCities = onSnapshot(citiesColRef, (snapshot) => {
            const citiesData = {};
            snapshot.forEach(doc => {
                citiesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setPlayerCities(citiesData);
            setPlayerHasCities(!snapshot.empty);

            if (!snapshot.empty && !activeCityId) {
                setActiveCityId(snapshot.docs[0].id);
            } else if (snapshot.empty) {
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
            unsubscribeCities();
            unsubscribeVillages();
            unsubscribeRuins();
        };
    }, [currentUser, worldId, activeCityId]);

    const activeCity = playerCities[activeCityId] || null;
    // This is a legacy property for components that haven't been updated for multi-city yet.
    // It provides the data of the currently active city.
    const gameState = activeCity; 
    // This is another legacy property for components expecting a single city object on the map.
    const playerCity = activeCity;

    const value = { 
        worldId,
        worldState,
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
        // Legacy support
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
