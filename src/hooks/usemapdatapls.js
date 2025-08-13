import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const CHUNK_SIZE = 10; // #comment Reduced chunk size for more efficient, targeted data fetching.
const TILE_SIZE = 32;

export const useMapData = (currentUser, worldId, worldState, pan, zoom, viewportSize) => {
    const [cachedCitySlots, setCachedCitySlots] = useState({});
    const [visibleSlots, setVisibleSlots] = useState({});
    const activeListenersRef = useRef({});

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
        // Cleanup all listeners on unmount
        return () => {
            Object.values(activeListenersRef.current).forEach(unsubscribe => unsubscribe());
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
                const chunkKey = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
                requiredChunks.add(chunkKey);
            }
        }

        // Unsubscribe from chunks that are no longer visible
        Object.keys(activeListenersRef.current).forEach(chunkKey => {
            if (!requiredChunks.has(chunkKey)) {
                activeListenersRef.current[chunkKey]();
                delete activeListenersRef.current[chunkKey];
            }
        });

        // Subscribe to new visible chunks
        requiredChunks.forEach(chunkKey => {
            if (!activeListenersRef.current[chunkKey]) {
                const [chunkX, chunkY] = chunkKey.split(',').map(Number);
                const q = query(
                    collection(db, 'worlds', worldId, 'citySlots'),
                    where('x', '>=', chunkX * CHUNK_SIZE), where('x', '<', (chunkX + 1) * CHUNK_SIZE),
                    where('y', '>=', chunkY * CHUNK_SIZE), where('y', '<', (chunkY + 1) * CHUNK_SIZE)
                );

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const chunkData = {};
                    snapshot.forEach(doc => {
                        chunkData[doc.id] = { id: doc.id, ...doc.data() };
                    });
                    setCachedCitySlots(prevCache => ({
                        ...prevCache,
                        [chunkKey]: chunkData
                    }));
                }, (error) => {
                    console.error(`Error fetching city slots for chunk ${chunkKey}:`, error);
                });
                activeListenersRef.current[chunkKey] = unsubscribe;
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

        const newVisible = {};
        Object.values(cachedCitySlots).forEach(chunk => {
            Object.values(chunk).forEach(slot => {
                if (slot.x >= viewStartCol && slot.x <= viewEndCol && slot.y >= viewStartRow && slot.y <= viewEndRow) {
                    newVisible[slot.id] = slot;
                }
            });
        });
        setVisibleSlots(newVisible);

    }, [cachedCitySlots, pan, zoom, viewportSize]);


    return {
        visibleSlots,
        invalidateChunkCache
    };
};
