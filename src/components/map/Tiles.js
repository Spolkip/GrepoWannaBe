// src/components/map/Tiles.js
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ruinImage from '../../images/ruin_new.png';

const defaultSettings = { showVisuals: true, showGrid: true };

export const WaterTile = React.memo(({ gameSettings = defaultSettings }) => {
    // #comment Use the new animated class from index.css for the visual effect.
    const bgClass = gameSettings.showVisuals ? 'water-tile-animated' : 'bg-blue-800';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-blue-900/20' : 'border-gray-800'}`
        : 'border-r border-b border-transparent';
        
    // #comment The background is now handled by the CSS class, not inline styles.
    return <div className={`w-full h-full ${bgClass} ${borderClass}`} />;
});

export const LandTile = React.memo(({ gameSettings = defaultSettings }) => {
    const bgClass = gameSettings.showVisuals ? 'bg-green-600' : 'bg-gray-800';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-green-700' : 'border-gray-700'}`
        : 'border-r border-b border-transparent';
    return <div className={`w-full h-full ${bgClass} ${borderClass}`} />;
});

export const CitySlotTile = React.memo(({ slotData, onClick, isPlacingDummyCity, playerAlliance, gameSettings = defaultSettings }) => {
    const { currentUser } = useAuth();
    let slotClass = 'empty-slot';
    let tooltipText = `Empty Plot (${slotData.x}, ${slotData.y})`;

    if (slotData.ownerId) {
        const ownerName = slotData.ownerUsername || 'Unknown';
        const cityAllianceTag = slotData.alliance;

        if (slotData.ownerId === currentUser.uid) {
            slotClass = 'my-city';
            tooltipText = `Your City: ${slotData.cityName}`;
        } else if (playerAlliance && playerAlliance.tag && cityAllianceTag) {
            const allies = playerAlliance.diplomacy?.allies || [];
            const enemies = playerAlliance.diplomacy?.enemies || [];

            if (cityAllianceTag.toUpperCase() === playerAlliance.tag.toUpperCase()) {
                slotClass = 'alliance-city';
                tooltipText = `Ally: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
            } else if (allies.some(ally => ally && ally.tag && ally.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                slotClass = 'ally-city';
                tooltipText = `Ally: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
            } else if (enemies.some(enemy => enemy && enemy.tag && enemy.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                slotClass = 'enemy-city';
                tooltipText = `Enemy: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
            } else {
                slotClass = 'neutral-city';
                tooltipText = `City: ${slotData.cityName}<br>Owner: ${ownerName}<br>Faction: ${slotData.ownerFaction || 'Unknown'}`;
            }
        } else if (slotData.ownerId.startsWith('dummy_')) {
            slotClass = 'dummy-city-plot';
            tooltipText = `Dummy City: ${slotData.cityName}<br>Owner: ${ownerName}`;
        } else {
            slotClass = 'neutral-city';
            tooltipText = `City: ${slotData.cityName}<br>Owner: ${ownerName}<br>Faction: ${slotData.ownerFaction || 'Unknown'}`;
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
});

export const FarmingVillageTile = React.memo(({ villageData, onClick, conqueredVillages, gameSettings = defaultSettings }) => {
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
});

export const RuinTile = React.memo(({ ruinData, onClick, gameSettings = defaultSettings }) => {
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

    const bgClass = gameSettings.showVisuals ? 'bg-blue-900' : 'bg-gray-900';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-blue-950' : 'border-gray-800'}`
        : 'border-r border-b border-transparent';

    return (
        <div className={`w-full h-full ${bgClass} ${borderClass} flex justify-center items-center`}>
            <div
                onClick={(e) => onClick(e, ruinData)}
                className={ruinClass}
                style={{ backgroundImage: `url(${ruinImage})` }}
            >
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
});
