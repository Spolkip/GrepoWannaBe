// src/components/map/Tiles.js
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const defaultSettings = { showVisuals: true, showGrid: true };

export const WaterTile = React.memo(({ gameSettings = defaultSettings }) => {
    const bgClass = gameSettings.showVisuals ? 'bg-blue-800' : 'bg-gray-900';
    const borderClass = gameSettings.showGrid
        ? `border-r border-b ${gameSettings.showVisuals ? 'border-blue-900' : 'border-gray-800'}`
        : 'border-r border-b border-transparent';
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
        } else if (playerAlliance && cityAllianceTag) {
            // #comment Check diplomacy status if the player and the city's owner are in alliances
            if (cityAllianceTag.toUpperCase() === playerAlliance.tag.toUpperCase()) {
                slotClass = 'alliance-city'; // Your own alliance members
                tooltipText = `Ally: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
            } else if (playerAlliance.diplomacy?.allies?.some(ally => ally.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                slotClass = 'ally-city'; // Allied alliances
                tooltipText = `Ally: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
            } else if (playerAlliance.diplomacy?.enemies?.some(enemy => enemy.tag.toUpperCase() === cityAllianceTag.toUpperCase())) {
                slotClass = 'enemy-city'; // Enemy alliances
                tooltipText = `Enemy: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
            } else {
                slotClass = 'neutral-city'; // A player in an alliance you have no diplomacy with
                tooltipText = `City: ${slotData.cityName}<br>Owner: ${ownerName}<br>Faction: ${slotData.ownerFaction || 'Unknown'}`;
            }
        } else if (slotData.ownerId.startsWith('dummy_')) {
            slotClass = 'dummy-city-plot';
            tooltipText = `Dummy City: ${slotData.cityName}<br>Owner: ${ownerName}`;
        } else {
            // #comment Neutral player with no alliance
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

    const isConqueredByPlayer = conqueredVillages && conqueredVillages[villageData.id];

    if (isConqueredByPlayer) {
        villageClass = 'my-village';
        tooltipText = `Your Village: ${villageData.name}`;
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
            <div onClick={(e) => onClick(e, ruinData)} className={ruinClass}>
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
});
