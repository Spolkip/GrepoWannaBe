import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const CHUNK_SIZE = 50;
const TILE_SIZE = 32;


export const useMapData = (currentUser, worldId, worldState, pan, zoom, viewportSize) => {
    const [movements, setMovements] = useState([]);
    const [cachedCitySlots, setCachedCitySlots] = useState({});
    const [visibleSlots, setVisibleSlots] = useState({});
    const [villages, setVillages] = useState({});


    const invalidateChunkCache = useCallback((x, y) => {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkY}`;
        setCachedCitySlots(prevCache => {
            const newCache = { ...prevCache };
            delete newCache[chunkKey];
            return newCache;
        });
    }, []);

    useEffect(() => {
        if (!worldId || !currentUser) return;
        const movementsRef = collection(db, 'worlds', worldId, 'movements');
        const q = query(movementsRef, where('involvedParties', 'array-contains', currentUser.uid));
        const unsubscribeMovements = onSnapshot(q, (snapshot) => {
            const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovements(allMovements.sort((a, b) => a.arrivalTime.toMillis() - b.arrivalTime.toMillis()));
        });

        const villagesColRef = collection(db, 'worlds', worldId, 'villages');
        const unsubscribeVillages = onSnapshot(villagesColRef, (snapshot) => {
            const villagesData = {};
            snapshot.docs.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setVillages(villagesData);
        });

        return () => {
            unsubscribeMovements();
            unsubscribeVillages();
        };
    }, [worldId, currentUser]);


    useEffect(() => {
        const fetchVisibleSlots = async () => {
            if (!worldState || viewportSize.width === 0 || zoom <= 0 || !worldId) return;

            const scaledTileSize = TILE_SIZE * zoom;
            const viewStartCol = Math.floor(-pan.x / scaledTileSize);
            const viewEndCol = Math.ceil((-pan.x + viewportSize.width) / scaledTileSize);
            const viewStartRow = Math.floor(-pan.y / scaledTileSize);
            const viewEndRow = Math.ceil((-pan.y + viewportSize.height) / scaledTileSize);

            const newVisible = {};
            const chunksToFetch = new Set();
            let needsFetch = false;

            for (let y = viewStartRow; y <= viewEndRow; y++) {
                for (let x = viewStartCol; x <= viewEndCol; x++) {
                    const chunkKey = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
                    if (!cachedCitySlots[chunkKey]) {
                        needsFetch = true;
                        chunksToFetch.add(chunkKey);
                    } else {
                        Object.values(cachedCitySlots[chunkKey]).forEach(slot => {
                            if (slot.x >= viewStartCol && slot.x <= viewEndCol && slot.y >= viewStartRow && slot.y <= viewEndRow) {
                                newVisible[slot.id] = slot;
                            }
                        });
                    }
                }
            }

            if (needsFetch) {
                const newCache = { ...cachedCitySlots };
                await Promise.all(Array.from(chunksToFetch).map(async (key) => {
                    const [chunkX, chunkY] = key.split(',').map(Number);
                    const q = query(
                        collection(db, 'worlds', worldId, 'citySlots'),
                        where('x', '>=', chunkX * CHUNK_SIZE), where('x', '<', (chunkX + 1) * CHUNK_SIZE),
                        where('y', '>=', chunkY * CHUNK_SIZE), where('y', '<', (chunkY + 1) * CHUNK_SIZE)
                    );
                    try {
                        const snapshot = await getDocs(q);
                        const chunkData = {};
                        snapshot.forEach(doc => {
                            chunkData[doc.id] = { id: doc.id, ...doc.data() };
                            if (doc.data().x >= viewStartCol && doc.data().x <= viewEndCol && doc.data().y >= viewStartRow && doc.data().y <= viewEndRow) {
                                newVisible[doc.id] = { id: doc.id, ...doc.data() };
                            }
                        });
                        newCache[key] = chunkData;
                    } catch (error) {
                           console.error(`Error fetching city slots for chunk ${key}:`, error);
                    }
                }));
                setCachedCitySlots(newCache);
            }
            setVisibleSlots(newVisible);
        };
        const timer = setTimeout(fetchVisibleSlots, 200);
        return () => clearTimeout(timer);
    }, [pan, zoom, viewportSize.width, viewportSize.height, worldState, worldId, cachedCitySlots]);


    return {
        movements,
        visibleSlots,
        villages,
        invalidateChunkCache
    };
};