import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase/config';

const CityHeader = ({ cityGameState, worldId, showMap, onCityNameChange, setMessage, onOpenCheats }) => {
    const { currentUser, userProfile } = useAuth();
    const [isEditingCityName, setIsEditingCityName] = useState(false);
    const [newCityName, setNewCityName] = useState(cityGameState.cityName);

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

        const citySlotId = cityGameState.cityLocation?.slotId;
        if (!citySlotId) {
            setMessage("Error: City location is unknown.");
            return;
        }

        try {
            const batch = writeBatch(db);
            const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
            const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);

            batch.update(gameDocRef, { cityName: trimmedName });
            batch.update(citySlotRef, { cityName: trimmedName });

            await batch.commit();
            onCityNameChange(trimmedName); // Inform parent of the change
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

    return (
        <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center p-4 bg-gray-800 shadow-lg border-b border-gray-700 z-10">
            <div>
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
                        onDoubleClick={() => setIsEditingCityName(true)}
                        title="Double-click to rename"
                    >
                        {cityGameState.cityName}
                    </h1>
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