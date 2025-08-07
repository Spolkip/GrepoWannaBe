// src/components/map/Tiles.js
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ruinImage from '../../images/ruin_new.png';
import unitConfig from '../../gameData/units.json';
import godTownImage from '../../images/god-town.png';

// #comment Dynamically import all unit images so they can be used in the tooltip
const images = {};
const imageContext = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    images[key] = imageContext(item);
});

const defaultSettings = { showVisuals: true, showGrid: true };

// Define components first without exporting them directly
const _WaterTile = ({ gameSettings = defaultSettings }) => {
    return <div className="w-full h-full bg-transparent" />;
};

const _LandTile = ({ gameSettings = defaultSettings }) => {
    const bgClass = gameSettings.showVisuals ? 'bg-green-600' : 'bg-gray-800';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';
    return <div className={`w-full h-full ${bgClass} ${borderClass}`} />;
};

const _CitySlotTile = ({ slotData, onClick, isPlacingDummyCity, playerAlliance, gameSettings = defaultSettings, cityPoints, scoutedCities }) => {
    const { currentUser } = useAuth();
    let slotClass = 'empty-slot';
    let tooltipText = `Empty Plot (${slotData.x}, ${slotData.y})`;

    const formatUnitsForTooltip = (units) => {
        if (!units || Object.keys(units).length === 0) return '';
        const unitEntries = Object.entries(units)
            .filter(([, count]) => count > 0)
            .map(([id, count]) => {
                const unit = unitConfig[id];
                if (!unit) return '';
                const imageUrl = images[unit.image];
                return `
                    <div class="tooltip-troop-item">
                        <img src="${imageUrl}" alt="${unit.name}" class="tooltip-troop-image" />
                        <span class="tooltip-troop-count">${count}</span>
                    </div>
                `;
            })
            .join('');
        if (!unitEntries) return '';
        return `<hr class="tooltip-hr"><b>City Units</b><br><div class="tooltip-troop-grid">${unitEntries}</div>`;
    };

    if (slotData.ownerId) {
        const ownerName = slotData.ownerUsername || 'Unknown';
        const cityAllianceTag = slotData.alliance;
        const points = cityPoints[slotData.id] ? cityPoints[slotData.id].toLocaleString() : '...';

        let troopsHTML = '';
        // #comment Check for troops in own city or in scouted reports for other cities
        if (slotData.ownerId === currentUser.uid) {
            slotClass = 'my-city';
            troopsHTML = formatUnitsForTooltip(slotData.units);
        } else if (scoutedCities && scoutedCities[slotData.id]) {
            troopsHTML = formatUnitsForTooltip(scoutedCities[slotData.id]);
        }

        // #comment Construct the base info part of the tooltip
        const baseInfo = `
            <div class="tooltip-info-section">
                <b>${slotData.cityName}</b><br>
                Owner: ${ownerName}<br>
                Points: ${points}<br>
                Alliance: ${slotData.allianceName || 'None'}
            </div>
        `;

        // #comment Combine base info with troops if available
        tooltipText = `${baseInfo}${troopsHTML}`;
        
        // #comment Determine the city color based on diplomatic status if it's not the player's city
        if (slotData.ownerId !== currentUser.uid) {
            if (playerAlliance && playerAlliance.tag && cityAllianceTag) {
                const allies = playerAlliance.diplomacy?.allies || [];
                const enemies = playerAlliance.diplomacy?.enemies || [];

                if (cityAllianceTag.toUpperCase() === playerAlliance.tag.toUpperCase()) {
                    slotClass = 'alliance-city';
                } else if (allies.some(ally => ally && ally.tag && ally.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                    slotClass = 'ally-city';
                } else if (enemies.some(enemy => enemy && enemy.tag && enemy.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                    slotClass = 'enemy-city';
                } else {
                    slotClass = 'neutral-city';
                }
            } else if (slotData.ownerId.startsWith('dummy_')) {
                slotClass = 'dummy-city-plot';
            } else {
                slotClass = 'neutral-city';
            }
        }

    } else if (isPlacingDummyCity) {
        slotClass = 'dummy-placement-plot';
        tooltipText = 'Click to place dummy city';
    }


    const backgroundClass = gameSettings.showVisuals ? 'bg-green-400' : 'bg-gray-800';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';

    return (
        <div className={`w-full h-full ${backgroundClass} ${borderClass} flex justify-center items-center`}>
            <div onClick={(e) => onClick(e, slotData)} className={`city-slot ${slotClass}`}>
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};

const _FarmingVillageTile = ({ villageData, onClick, conqueredVillages, gameSettings = defaultSettings }) => {
    let villageClass = 'neutral-village';
    let tooltipText = `Village: ${villageData.name}<br>Level: ${villageData.level}`;

    const conqueredData = conqueredVillages ? conqueredVillages[villageData.id] : null;

    if (conqueredData) {
        villageClass = 'my-village';
        const happiness = conqueredData.happiness !== undefined ? conqueredData.happiness : 100;
        tooltipText = `Your Village: ${villageData.name}<br>Happiness: ${Math.floor(happiness)}%`;
    }

    const backgroundClass = gameSettings.showVisuals ? 'bg-green-500' : 'bg-gray-800';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';

    return (
        <div className={`w-full h-full ${backgroundClass} ${borderClass} flex justify-center items-center`}>
            <div onClick={(e) => onClick(e, villageData)} className={`village-slot ${villageClass}`}>
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};

const _RuinTile = ({ ruinData, onClick, gameSettings = defaultSettings }) => {
    const { currentUser } = useAuth();
    let ruinClass = 'ruin-slot';
    let tooltipText = `Ruin: ${ruinData.name}`;

    if (ruinData.ownerId) {
        if (ruinData.ownerId === currentUser.uid) {
            ruinClass += ' my-ruin';
            tooltipText = `Conquered Ruin<br>Owner: You`;
        } else {
            ruinClass += ' conquered-ruin';
            tooltipText = `Conquered Ruin<br>Owner: ${ruinData.ownerUsername}`;
        }
    }

    const bgClass = 'bg-transparent'; // Use the parent's water texture

    return (
        <div className={`w-full h-full ${bgClass} flex justify-center items-center`}>
            <div
                onClick={(e) => onClick(e, ruinData)}
                className={ruinClass}
                style={{ backgroundImage: `url(${ruinImage})` }}
            >
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};

const _GodTownTile = ({ townData, onClick, gameSettings = defaultSettings }) => {
    let townClass = 'god-town-slot';
    let tooltipText = `God Town: ${townData.name}`;
    let image = townData.stage === 'ruins' ? ruinImage : godTownImage;

    if (townData.stage === 'ruins') {
        townClass += ' ruins';
        tooltipText = `Strange Ruins`;
    } else if (townData.stage === 'city') {
        townClass += ' city';
        tooltipText = `God Town: ${townData.name}<br>Health: ${townData.health}`;
    }

    const bgClass = 'bg-transparent';

    return (
        <div className={`w-full h-full ${bgClass} flex justify-center items-center`}>
            <div
                onClick={() => onClick(townData.id)} // #comment Pass the ID, not the whole object
                className={townClass}
                style={{ backgroundImage: `url(${image})` }}
            >
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
};

// Now, memoize and export the components
export const WaterTile = React.memo(_WaterTile);
export const LandTile = React.memo(_LandTile);
export const CitySlotTile = React.memo(_CitySlotTile);
export const FarmingVillageTile = React.memo(_FarmingVillageTile);
export const RuinTile = React.memo(_RuinTile);
export const GodTownTile = React.memo(_GodTownTile);
