// src/components/map/Tiles.js
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const WaterTile = React.memo(() => (
    <div className="w-full h-full bg-blue-800 border-r border-b border-blue-900" />
));

export const LandTile = React.memo(() => (
    <div className="w-full h-full bg-green-600 border-r border-b border-green-700" />
));

export const CitySlotTile = React.memo(({ slotData, onClick, isPlacingDummyCity, playerAlliance }) => {
    const { currentUser } = useAuth();
    let slotClass = 'empty-slot';
    let tooltipText = `Empty Plot (${slotData.x}, ${slotData.y})`;

    if (slotData.ownerId) {
        const ownerName = slotData.ownerUsername || 'Unknown';
        if (slotData.ownerId === currentUser.uid) {
            slotClass = 'my-city';
            tooltipText = `Your City: ${slotData.cityName}`;
        } else if (playerAlliance && slotData.alliance === playerAlliance) {
            slotClass = 'alliance-city';
            tooltipText = `Ally: ${slotData.cityName}<br>Owner: ${ownerName}<br>Alliance: ${slotData.allianceName || 'Unknown'}`;
        } else if (slotData.ownerId.startsWith('dummy_')) {
            slotClass = 'dummy-city-plot';
            tooltipText = `Dummy City: ${slotData.cityName}<br>Owner: ${ownerName}`;
        } else {
            slotClass = 'other-city';
            tooltipText = `City: ${slotData.cityName}<br>Owner: ${ownerName}<br>Faction: ${slotData.ownerFaction || 'Unknown'}`;
        }
    } else if (isPlacingDummyCity) {
        slotClass = 'dummy-placement-plot';
        tooltipText = 'Click to place dummy city';
    }

    return (
        <div className="w-full h-full bg-green-400 border-r border-b border-green-700 flex justify-center items-center">
            <div onClick={(e) => onClick(e, slotData)} className={`city-slot ${slotClass}`}>
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
});

export const FarmingVillageTile = React.memo(({ villageData, onClick }) => {
    const { currentUser } = useAuth();
    let villageClass = 'neutral-village';
    let tooltipText = `Village: ${villageData.name}<br>Level: ${villageData.level}`;

    if (villageData.ownerId) {
        const ownerName = villageData.ownerUsername || 'Unknown';
        if (villageData.ownerId === currentUser.uid) {
            villageClass = 'my-village';
            tooltipText = `Your Village: ${villageData.name}`;
        } else {
            villageClass = 'other-village-plot';
            tooltipText = `Village: ${villageData.name}<br>Owner: ${ownerName}`;
        }
    }

    return (
        <div className="w-full h-full bg-green-500 border-r border-b border-green-700 flex justify-center items-center">
            <div onClick={(e) => onClick(e, villageData)} className={`village-slot ${villageClass}`}>
                <span className="map-object-tooltip" dangerouslySetInnerHTML={{ __html: tooltipText }}></span>
            </div>
        </div>
    );
});
