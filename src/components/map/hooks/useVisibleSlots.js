import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';

const TILE_SIZE = 32;
const CHUNK_SIZE = 50;

export const useVisibleSlots = (pan, zoom, viewportSize, worldState, worldId, playerCity) => {
    const [cachedCitySlots, setCachedCitySlots] = useState({});
    const [visibleSlots, setVisibleSlots] = useState({});

    useEffect(() => {
        const fetchVisibleSlots = async () => {
            if (!worldState || !viewportSize.width || zoom <= 0 || !worldId) return;

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

    const combinedSlots = useMemo(() => {
        const slots = { ...visibleSlots };
        if (playerCity) {
            slots[playerCity.id] = playerCity;
        }
        return slots;
    }, [visibleSlots, playerCity]);


    return { visibleSlots: combinedSlots, setCachedCitySlots };
};