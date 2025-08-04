import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase/config';

// #comment A dropdown to show all player cities and allow switching between them
const CityListDropdown = ({ cities, onSelect, onClose, activeCityId }) => {
    const dropdownRef = useRef(null);

    // #comment Close dropdown if clicked outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <div ref={dropdownRef} className="absolute top-full mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
            <ul>
                {Object.values(cities).map(city => (
                    <li key={city.id}>
                        <button
                            onClick={() => onSelect(city.id)}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-700 ${city.id === activeCityId ? 'bg-blue-600' : ''}`}
                        >
                            {city.cityName}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const CityHeader = ({ cityGameState, worldId, showMap, onCityNameChange, setMessage, onOpenCheats, playerCities, onSelectCity, activeCityId }) => {
    const { currentUser, userProfile } = useAuth();
    const [isEditingCityName, setIsEditingCityName] = useState(false);
    const [newCityName, setNewCityName] = useState(cityGameState.cityName);
    const [isCityListOpen, setIsCityListOpen] = useState(false);

    useEffect(() => {
        if (!isEditingCityName) {
            setNewCityName(cityGameState.cityName);
        }
    }, [cityGameState.cityName, isEditingCityName]);

    const handleCityNameSave = async () => {
        const trimmedName = newCityName.trim();
        if (!trimmedName || trimmedName === cityGameState.cityName) {
            setIsEditingCityName(false);
            return;
        }
        if (trimmedName.length > 20) {
            setMessage("City name cannot exceed 20 characters.");
            return;
        }

        const cityDocId = cityGameState.id;
        if (!cityDocId) {
            setMessage("Error: City document ID is unknown.");
            return;
        }

        try {
            const batch = writeBatch(db);
            const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', cityDocId);
            const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', cityGameState.slotId);

            batch.update(cityDocRef, { cityName: trimmedName });
            batch.update(citySlotRef, { cityName: trimmedName });

            await batch.commit();
            onCityNameChange(trimmedName);
            setMessage("City name updated!");
        } catch (error) {
            console.error("Failed to update city name:", error);
            setMessage("Error updating city name.");
        } finally {
            setIsEditingCityName(false);
        }
    };

    const handleCityNameKeyDown = (e) => {
        if (e.key === 'Enter') handleCityNameSave();
        else if (e.key === 'Escape') setIsEditingCityName(false);
    };

    const handleCitySelect = (cityId) => {
        onSelectCity(cityId);
        setIsCityListOpen(false);
    };

    return (
        <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center p-4 bg-gray-800 shadow-lg border-b border-gray-700 z-10">
            <div className="relative">
                {isEditingCityName ? (
                    <input
                        type="text"
                        value={newCityName}
                        onChange={(e) => setNewCityName(e.target.value)}
                        onBlur={handleCityNameSave}
                        onKeyDown={handleCityNameKeyDown}
                        className="font-title text-3xl bg-gray-700 text-gray-200 border border-gray-500 rounded px-2"
                        autoFocus
                    />
                ) : (
                    <h1 
                        className="font-title text-3xl text-gray-300 cursor-pointer hover:bg-gray-700/50 rounded px-2"
                        onClick={() => setIsCityListOpen(prev => !prev)}
                        onDoubleClick={() => setIsEditingCityName(true)}
                        title="Single-click to switch city, double-click to rename"
                    >
                        {cityGameState.cityName}
                    </h1>
                )}
                {isCityListOpen && (
                    <CityListDropdown
                        cities={playerCities}
                        onSelect={handleCitySelect}
                        onClose={() => setIsCityListOpen(false)}
                        activeCityId={activeCityId}
                    />
                )}
                {cityGameState.god && <p className="text-lg text-yellow-400 font-semibold">Worshipping: {cityGameState.god}</p>}
                <p className="text-sm text-blue-300">{`${cityGameState.playerInfo.nation} (${cityGameState.playerInfo.religion})`}</p>
                <button onClick={showMap} className="text-sm text-blue-400 hover:text-blue-300 mt-1">← Return to Map</button>
            </div>
            <div className="text-center sm:text-right mt-2 sm:mt-0">
                <p className="text-xs text-gray-400">Player: <span className="font-mono">{userProfile?.username || currentUser?.email}</span></p>
                <div className="flex items-center justify-end space-x-4">
                    {userProfile?.is_admin && (
                        <button onClick={onOpenCheats} className="text-sm text-yellow-400 hover:text-yellow-300 mt-1">Admin Cheats</button>
                    )}
                    <button onClick={() => signOut(auth)} className="text-sm text-red-400 hover:text-red-300 mt-1">Logout</button>
                </div>
            </div>
        </header>
    );
};

export default CityHeader;