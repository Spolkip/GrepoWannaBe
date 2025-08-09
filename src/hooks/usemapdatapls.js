import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const CHUNK_SIZE = 50;
const TILE_SIZE = 32;

export const useMapData = (currentUser, worldId, worldState, pan, zoom, viewportSize) => {
    const [cachedCitySlots, setCachedCitySlots] = useState({});
    const [cachedVillages, setCachedVillages] = useState({});
    const [cachedRuins, setCachedRuins] = useState({});
    const [cachedGodTowns, setCachedGodTowns] = useState({});

    const [visibleSlots, setVisibleSlots] = useState({});
    const [visibleVillages, setVisibleVillages] = useState({});
    const [visibleRuins, setVisibleRuins] = useState({});
    const [visibleGodTowns, setVisibleGodTowns] = useState({});

    const activeListenersRef = useRef({});

    const invalidateChunkCache = useCallback((x, y) => {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkY}`;
        setCachedCitySlots(prev => { const newCache = { ...prev }; delete newCache[chunkKey]; return newCache; });
        setCachedVillages(prev => { const newCache = { ...prev }; delete newCache[chunkKey]; return newCache; });
        setCachedRuins(prev => { const newCache = { ...prev }; delete newCache[chunkKey]; return newCache; });
        setCachedGodTowns(prev => { const newCache = { ...prev }; delete newCache[chunkKey]; return newCache; });
    }, []);

    useEffect(() => {
        return () => {
            Object.values(activeListenersRef.current).forEach(unsub => unsub());
            activeListenersRef.current = {};
        };
    }, []);

    useEffect(() => {
        if (!worldState || viewportSize.width === 0 || zoom <= 0 || !worldId) {
            return;
        }

        const scaledTileSize = TILE_SIZE * zoom;
        const viewStartCol = Math.floor(-pan.x / scaledTileSize) - 1;
        const viewEndCol = Math.ceil((-pan.x + viewportSize.width) / scaledTileSize) + 1;
        const viewStartRow = Math.floor(-pan.y / scaledTileSize) - 1;
        const viewEndRow = Math.ceil((-pan.y + viewportSize.height) / scaledTileSize) + 1;

        const requiredChunks = new Set();
        for (let y = viewStartRow; y <= viewEndRow; y++) {
            for (let x = viewStartCol; x <= viewEndCol; x++) {
                requiredChunks.add(`${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`);
            }
        }

        Object.keys(activeListenersRef.current).forEach(chunkKey => {
            if (!requiredChunks.has(chunkKey)) {
                activeListenersRef.current[chunkKey]();
                delete activeListenersRef.current[chunkKey];
            }
        });

        requiredChunks.forEach(chunkKey => {
            if (!activeListenersRef.current[chunkKey]) {
                const [chunkX, chunkY] = chunkKey.split(',').map(Number);
                const xMin = chunkX * CHUNK_SIZE;
                const xMax = (chunkX + 1) * CHUNK_SIZE;
                const yMin = chunkY * CHUNK_SIZE;
                const yMax = (chunkY + 1) * CHUNK_SIZE;

                const createListener = (collectionName, setData) => {
                    const q = query(
                        collection(db, 'worlds', worldId, collectionName),
                        where('x', '>=', xMin), where('x', '<', xMax),
                        where('y', '>=', yMin), where('y', '<', yMax)
                    );
                    return onSnapshot(q, (snapshot) => {
                        const chunkData = {};
                        snapshot.forEach(doc => {
                            chunkData[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        setData(prev => ({ ...prev, [chunkKey]: chunkData }));
                    }, (error) => console.error(`Error fetching ${collectionName} for chunk ${chunkKey}:`, error));
                };

                const unsubCitySlots = createListener('citySlots', setCachedCitySlots);
                const unsubVillages = createListener('villages', setCachedVillages);
                const unsubRuins = createListener('ruins', setCachedRuins);
                const unsubGodTowns = createListener('godTowns', setCachedGodTowns);
                
                activeListenersRef.current[chunkKey] = () => {
                    unsubCitySlots();
                    unsubVillages();
                    unsubRuins();
                    unsubGodTowns();
                };
            }
        });

    }, [pan, zoom, viewportSize, worldState, worldId]);
    
    useEffect(() => {
        if (viewportSize.width === 0) return;

        const scaledTileSize = TILE_SIZE * zoom;
        const viewStartCol = Math.floor(-pan.x / scaledTileSize);
        const viewEndCol = Math.ceil((-pan.x + viewportSize.width) / scaledTileSize);
        const viewStartRow = Math.floor(-pan.y / scaledTileSize);
        const viewEndRow = Math.ceil((-pan.y + viewportSize.height) / scaledTileSize);

        const filterVisible = (cachedData) => {
            const newVisible = {};
            Object.values(cachedData).forEach(chunk => {
                Object.values(chunk).forEach(item => {
                    if (item.x >= viewStartCol && item.x <= viewEndCol && item.y >= viewStartRow && item.y <= viewEndRow) {
                        newVisible[item.id] = item;
                    }
                });
            });
            return newVisible;
        };

        setVisibleSlots(filterVisible(cachedCitySlots));
        setVisibleVillages(filterVisible(cachedVillages));
        setVisibleRuins(filterVisible(cachedRuins));
        setVisibleGodTowns(filterVisible(cachedGodTowns));

    }, [cachedCitySlots, cachedVillages, cachedRuins, cachedGodTowns, pan, zoom, viewportSize]);


    return {
        visibleSlots,
        visibleVillages,
        visibleRuins,
        visibleGodTowns,
        invalidateChunkCache
    };
};
