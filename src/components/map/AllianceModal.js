// src/components/map/AllianceModal.js
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';

const AllianceModal = ({ onClose }) => {
    const { currentUser } = useAuth();
    const { worldId, gameState, playerAlliance, setPlayerAlliance } = useGame();
    const [alliances, setAlliances] = useState([]);
    const [allianceDetails, setAllianceDetails] = useState(null);
    const [createAllianceName, setCreateAllianceName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAlliances = async () => {
            if (!worldId) return;
            const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
            const snapshot = await getDocs(alliancesRef);
            const allianceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAlliances(allianceList);

            if (playerAlliance) {
                const details = allianceList.find(a => a.id === playerAlliance);
                setAllianceDetails(details);
            }
        };

        fetchAlliances();
    }, [worldId, playerAlliance]);

    const handleCreateAlliance = async (e) => {
        e.preventDefault();
        if (!createAllianceName.trim()) {
            setError('Alliance name cannot be empty.');
            return;
        }
        if (!gameState?.cityLocation?.slotId) {
            setError('Could not find your city on the map.');
            return;
        }
        setIsLoading(true);
        setError('');

        const allianceId = createAllianceName.trim().toLowerCase().replace(/\s+/g, '-');
        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const playerGameRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameState.cityLocation.slotId);

        try {
            const batch = writeBatch(db);
            batch.set(allianceRef, {
                name: createAllianceName.trim(),
                leader: currentUser.uid,
                members: [currentUser.uid],
                createdAt: serverTimestamp(),
            });
            batch.update(playerGameRef, { alliance: allianceId });
            batch.update(citySlotRef, { alliance: allianceId, allianceName: createAllianceName.trim() });


            await batch.commit();
            setPlayerAlliance(allianceId);
            setCreateAllianceName('');
        } catch (err) {
            setError('Failed to create alliance. The name might be taken.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinAlliance = async (allianceId) => {
        if (!gameState?.cityLocation?.slotId) {
            setError('Could not find your city on the map.');
            return;
        }
        setIsLoading(true);
        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const playerGameRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameState.cityLocation.slotId);
        
        try {
            const allianceDoc = await getDoc(allianceRef);
            if (!allianceDoc.exists()) {
                throw new Error("Alliance not found.");
            }
            const allianceData = allianceDoc.data();
            const members = [...allianceData.members, currentUser.uid];

            const batch = writeBatch(db);
            batch.update(allianceRef, { members });
            batch.update(playerGameRef, { alliance: allianceId });
            batch.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });


            await batch.commit();
            setPlayerAlliance(allianceId);
        } catch (err) {
            setError('Failed to join alliance.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveAlliance = async () => {
        if (!gameState?.cityLocation?.slotId) {
            setError('Could not find your city on the map.');
            return;
        }
        setIsLoading(true);
        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance);
        const playerGameRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', gameState.cityLocation.slotId);

        try {
            const allianceDoc = await getDoc(allianceRef);
            if (!allianceDoc.exists()) {
                throw new Error("Alliance not found.");
            }
            const allianceData = allianceDoc.data();
            const members = allianceData.members.filter(uid => uid !== currentUser.uid);

            const batch = writeBatch(db);
            if (members.length === 0) {
                batch.delete(allianceRef);
            } else {
                batch.update(allianceRef, { members });
            }
            batch.update(playerGameRef, { alliance: null });
            batch.update(citySlotRef, { alliance: null, allianceName: null });

            await batch.commit();
            setPlayerAlliance(null);
            setAllianceDetails(null);
        } catch (err) {
            setError('Failed to leave alliance.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl">Alliance</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {error && <p className="text-red-400 text-center mb-4">{error}</p>}
                
                {playerAlliance && allianceDetails ? (
                    <div>
                        <h4 className="text-2xl font-bold text-yellow-400">{allianceDetails.name}</h4>
                        <p className="text-gray-400">Members: {allianceDetails.members.length}</p>
                        <button onClick={handleLeaveAlliance} disabled={isLoading} className="btn btn-danger w-full mt-4 py-2">
                            {isLoading ? 'Leaving...' : 'Leave Alliance'}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-xl font-bold mb-2">Join an Alliance</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {alliances.map(ally => (
                                    <div key={ally.id} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                                        <span>{ally.name} ({ally.members.length} members)</span>
                                        <button onClick={() => handleJoinAlliance(ally.id)} disabled={isLoading} className="btn btn-confirm px-3 py-1 text-sm">
                                            Join
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xl font-bold mb-2">Create an Alliance</h4>
                            <form onSubmit={handleCreateAlliance} className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={createAllianceName}
                                    onChange={(e) => setCreateAllianceName(e.target.value)}
                                    placeholder="Alliance Name"
                                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                                />
                                <button type="submit" disabled={isLoading} className="btn btn-primary py-2">
                                    {isLoading ? 'Creating...' : 'Create'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllianceModal;
