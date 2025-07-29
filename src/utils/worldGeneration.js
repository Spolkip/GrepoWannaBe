export const generateIslands = (width, height, count) => {
    const islands = [];
    const minMargin = 4;
    const maxMargin = 8;
    const maxAttempts = 20;

    const checkCollision = (newIsland, existingIslands) => {
        for (const existing of existingIslands) {
            const distance = Math.sqrt(
                Math.pow(newIsland.x - existing.x, 2) +
                Math.pow(newIsland.y - existing.y, 2)
            );
            const margin = minMargin + Math.random() * (maxMargin - minMargin);
            if (distance < newIsland.radius + existing.radius + margin) {
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < count; i++) {
        let island = {};
        let hasCollision = true;
        let attempts = 0;

        while (hasCollision && attempts < maxAttempts) {
            const radius = Math.random() * 3 + 4; // Radius between 4 and 7 tiles
            island = {
                id: `island-${Date.now()}-${i}`,
                name: `Island ${i + 1}`,
                x: Math.floor(Math.random() * (width - radius * 2)) + radius,
                y: Math.floor(Math.random() * (height - radius * 2)) + radius,
                radius: radius,
            };
            hasCollision = checkCollision(island, islands);
            attempts++;
        }

        if (!hasCollision) {
            islands.push(island);
        }
    }
    return islands;
};

export const generateCitySlots = (islands, worldWidth, worldHeight) => {
    const citySlots = {};
    const tempGrid = Array(worldHeight).fill(null).map(() => Array(worldWidth).fill(false));

    // First, map out all land tiles
    islands.forEach(island => {
        const centerX = Math.round(island.x);
        const centerY = Math.round(island.y);
        for (let i = -Math.floor(island.radius); i <= Math.ceil(island.radius); i++) {
            for (let j = -Math.floor(island.radius); j <= Math.ceil(island.radius); j++) {
                if (i * i + j * j <= island.radius * island.radius) {
                    const x = centerX + j;
                    const y = centerY + i;
                    if (y >= 0 && y < worldHeight && x >= 0 && x < worldWidth) {
                        tempGrid[y][x] = true;
                    }
                }
            }
        }
    });

    // Then, identify and create slots on coastal tiles
    islands.forEach(island => {
        const coastalTiles = [];
        const centerX = Math.round(island.x);
        const centerY = Math.round(island.y);

        for (let i = -Math.floor(island.radius); i <= Math.ceil(island.radius); i++) {
            for (let j = -Math.floor(island.radius); j <= Math.ceil(island.radius); j++) {
                if (i * i + j * j <= island.radius * island.radius) {
                    const x = centerX + j;
                    const y = centerY + i;
                    if (y >= 0 && y < worldHeight && x >= 0 && x < worldWidth && tempGrid[y][x]) {
                        const neighbors = [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]];
                        let isCoastal = false;
                        for (const [ny, nx] of neighbors) {
                            if (ny < 0 || ny >= worldHeight || nx < 0 || nx >= worldWidth || !tempGrid[ny][nx]) {
                                isCoastal = true;
                                break;
                            }
                        }
                        if (isCoastal) coastalTiles.push({ x, y });
                    }
                }
            }
        }

        coastalTiles.forEach((slot, index) => {
            const slotId = `${island.id}-slot-${index}`;
            citySlots[slotId] = {
                islandId: island.id,
                x: slot.x,
                y: slot.y,
                ownerId: null,
                cityName: 'Unclaimed',
                ownerEmail: null,
                ownerUsername: null,
                ownerFaction: null
            };
        });
    });

    return citySlots;
};

const generateVillageTroops = (level) => {
    let troops = {};
    switch (level) {
        case 1:
            troops = { swordsman: 15, archer: 10 };
            break;
        case 2:
            troops = { swordsman: 25, archer: 15, slinger: 5 };
            break;
        case 3:
            troops = { swordsman: 40, archer: 25, slinger: 10, hoplite: 5 };
            break;
        case 4:
            troops = { swordsman: 60, archer: 40, slinger: 20, hoplite: 15, cavalry: 5 };
            break;
        case 5:
            troops = { swordsman: 100, archer: 75, slinger: 50, hoplite: 40, cavalry: 20 };
            break;
        default:
            // Handle any other cases by defaulting to level 1 troops
            troops = { swordsman: 15, archer: 10 };
            break;
    }
    return troops;
};

export const generateFarmingVillages = (islands, citySlots, worldWidth, worldHeight) => {
    const villages = {};
    const occupiedSlots = new Set(Object.values(citySlots).map(slot => `${slot.x},${slot.y}`));
    const landTilesByIsland = new Map();

    // An array of the different demand cooldowns in seconds.
    const demandCooldowns = [
        300,    // 5 minutes
        1200,   // 20 minutes
        5400,   // 1 hour 30 minutes
        14400   // 4 hours
    ];

    islands.forEach(island => {
        landTilesByIsland.set(island.id, []);
        const centerX = Math.round(island.x);
        const centerY = Math.round(island.y);
        for (let i = -Math.floor(island.radius); i <= Math.ceil(island.radius); i++) {
            for (let j = -Math.floor(island.radius); j <= Math.ceil(island.radius); j++) {
                if (i * i + j * j <= island.radius * island.radius) {
                    const x = centerX + j;
                    const y = centerY + i;
                    if (y >= 0 && y < worldHeight && x >= 0 && x < worldWidth) {
                        landTilesByIsland.get(island.id).push({ x, y });
                    }
                }
            }
        }
    });

    landTilesByIsland.forEach((tiles, islandId) => {
        const availableTiles = tiles.filter(tile => !occupiedSlots.has(`${tile.x},${tile.y}`));
        const numVillages = Math.min(availableTiles.length, Math.floor(Math.random() * 3) + 2); // 2-4 villages per island

        for (let i = 0; i < numVillages; i++) {
            if (availableTiles.length === 0) break;

            const tileIndex = Math.floor(Math.random() * availableTiles.length);
            const tile = availableTiles[tileIndex];
            availableTiles.splice(tileIndex, 1);
            occupiedSlots.add(`${tile.x},${tile.y}`);

            const villageId = `v${islandId}-${i}`;
            const level = Math.ceil(Math.random() * 5);
            
            // Select a random cooldown from the array
            const randomCooldown = demandCooldowns[Math.floor(Math.random() * demandCooldowns.length)];

            villages[villageId] = {
                id: villageId,
                x: tile.x,
                y: tile.y,
                islandId: islandId,
                name: `Farming Village ${villageId}`,
                level: level,
                resources: { wood: 500, stone: 500, silver: 500 },
                maxResources: 1000 + level * 200,
                lastDemandTime: 0,
                demandCooldown: randomCooldown, // Assign the random cooldown
                troops: generateVillageTroops(level),
                ownerId: null,
                ownerUsername: null
            };
        }
    });

    return villages;
};