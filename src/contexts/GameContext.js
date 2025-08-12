import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { doc, onSnapshot, collection, writeBatch, updateDoc } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext'; // Import useNotification

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children, worldId }) => {
    const { currentUser } = useAuth();
    const { addNotification } = useNotification(); // Get addNotification from context
    const [playerGameData, setPlayerGameData] = useState(null);
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
        hideReturningReports: false,
        hideCompletedQuestsIcon: false,
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


        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const unsubscribeGameData = onSnapshot(gameDocRef, (docSnap) => {
            console.log("GameContext: gameDocRef snapshot triggered.");
            if (docSnap.exists()) {
                console.log("GameContext: Game document exists.");
                const data = docSnap.data();
                console.log("GameContext: Fetched game data:", data);

                if (data.battlePoints === undefined) {
                    console.log("GameContext: 'battlePoints' is undefined. Updating document...");


                    updateDoc(gameDocRef, { battlePoints: 0 });
                } else {
                    console.log("GameContext: Setting playerGameData with battlePoints:", data.battlePoints);
                    setPlayerGameData(data);
                }
            } else {
                console.log("GameContext: Game document does not exist.");
                setPlayerGameData(null);
            }
        });

        const citiesColRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const unsubscribeCities = onSnapshot(citiesColRef, (snapshot) => {
            const citiesData = {};
            let firstCityId = null;
            snapshot.forEach(doc => {
                if (!firstCityId) firstCityId = doc.id;
                citiesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setPlayerCities(citiesData);
            const hasCities = !snapshot.empty;
            setPlayerHasCities(hasCities);

            // #comment Use functional update to avoid dependency on activeCityId
            setActiveCityId(currentId => {
                if (hasCities && !currentId) {
                    console.log("GameContext: Setting initial active city ID:", firstCityId);
                    return firstCityId;
                }
                if (!hasCities) {
                    console.log("GameContext: No cities found, setting activeCityId to null.");
                    return null;
                }
                return currentId;
            });

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

    const gameState = activeCity;
    const playerCity = activeCity;



    const countCitiesOnIsland = useCallback((islandId) => {
        if (!islandId || !playerCities) return 0;
        return Object.values(playerCities).filter(city => city.islandId === islandId).length;
    }, [playerCities]);


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


    }, [currentUser, worldId, playerCities]);

    const value = {
        worldId,
        worldState,
        playerGameData,
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
        countCitiesOnIsland,
        renameCity,
        addNotification, // Pass addNotification through the context

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
