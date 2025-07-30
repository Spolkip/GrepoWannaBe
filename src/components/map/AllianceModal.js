// src/components/map/AllianceModal.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, writeBatch, serverTimestamp, getDoc, query, where, documentId, updateDoc, addDoc, orderBy, limit } from 'firebase/firestore'; // Added addDoc, orderBy, limit
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
    const [successMessage, setSuccessMessage] = useState('');
    const successTimeoutRef = useRef(null);

    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'members', 'properties', 'create', 'join'
    const [newAllianceNameInput, setNewAllianceNameInput] = useState('');
    const [allianceMembersData, setAllianceMembersData] = useState([]);
    const [allianceDescription, setAllianceDescription] = useState('');
    const [allianceEvents, setAllianceEvents] = useState([]); // New state for alliance events


    // Function to handle success messages with a timeout
    const showSuccessMessage = (message) => {
        setSuccessMessage(message);
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => {
            setSuccessMessage('');
        }, 2000); // Message disappears after 2 seconds
    };

    // Helper to log alliance events
    const logAllianceEvent = async (allianceId, type, message, details = {}) => {
        try {
            await addDoc(collection(db, 'worlds', worldId, 'alliances', allianceId, 'events'), {
                type,
                message,
                timestamp: serverTimestamp(),
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email, // Use display name if available
                ...details
            });
        } catch (eventError) {
            console.error("Error logging alliance event:", eventError);
        }
    };

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
                setNewAllianceNameInput(details?.name || '');
                setAllianceDescription(details?.description || '');
                setActiveTab('overview');
            } else {
                setActiveTab('join');
            }
        };

        fetchAlliances();
    }, [worldId, playerAlliance]);

    useEffect(() => {
        const fetchMembersData = async () => {
            setAllianceMembersData([]); 

            if (activeTab === 'members' && allianceDetails?.members?.length > 0) {
                const membersData = [];
                const memberIds = allianceDetails.members;
                const batchSize = 10;
                for (let i = 0; i < memberIds.length; i += batchSize) {
                    const batchIds = memberIds.slice(i, i + batchSize);
                    const q = query(collection(db, 'users'), where(documentId(), 'in', batchIds));
                    try {
                        const snapshot = await getDocs(q);
                        snapshot.forEach(doc => {
                            membersData.push({ id: doc.id, ...doc.data() });
                        });
                    } catch (err) {
                        console.error("Error fetching alliance members:", err);
                        setError("Failed to load members data.");
                    }
                }
                setAllianceMembersData(membersData);
            }
        };
        fetchMembersData();
    }, [activeTab, allianceDetails?.members]);

    // NEW: Fetch alliance events for the overview tab
    useEffect(() => {
        const fetchEvents = async () => {
            setAllianceEvents([]); // Clear previous events
            if (activeTab === 'overview' && allianceDetails?.id) {
                const eventsRef = collection(db, 'worlds', worldId, 'alliances', allianceDetails.id, 'events');
                const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(20)); // Get last 20 events
                try {
                    const snapshot = await getDocs(q);
                    const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setAllianceEvents(eventsList);
                } catch (err) {
                    console.error("Error fetching alliance events:", err);
                    setError("Failed to load alliance events.");
                }
            }
        };
        fetchEvents();
    }, [activeTab, allianceDetails?.id, worldId]); // Depend on activeTab, allianceDetails.id, and worldId

    const handleCreateAlliance = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!createAllianceName.trim()) {
            setError('Alliance name cannot be empty.');
            return;
        }
        if (!gameState?.cityLocation?.slotId) {
            setError('Could not find your city on the map.');
            return;
        }
        setIsLoading(true);

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
                description: ''
            });
            batch.update(playerGameRef, { alliance: allianceId });
            batch.update(citySlotRef, { alliance: allianceId, allianceName: createAllianceName.trim() });


            await batch.commit();
            setPlayerAlliance(allianceId);
            setCreateAllianceName('');
            setActiveTab('overview');
            showSuccessMessage('Alliance created successfully!');
            logAllianceEvent(allianceId, 'create', `${currentUser.displayName || currentUser.email} created the alliance.`);
        } catch (err) {
            setError('Failed to create alliance. The name might be taken.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinAlliance = async (allianceId) => {
        setError('');
        setSuccessMessage('');
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
            setActiveTab('overview');
            showSuccessMessage('Alliance joined successfully!');
            logAllianceEvent(allianceId, 'join', `${currentUser.displayName || currentUser.email} joined the alliance.`);
        } catch (err) {
            setError('Failed to join alliance.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveAlliance = async () => {
        setError('');
        setSuccessMessage('');
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
            setActiveTab('join');
            showSuccessMessage('Alliance left successfully!');
            logAllianceEvent(allianceData.id, 'leave', `${currentUser.displayName || currentUser.email} left the alliance.`, { leftAllianceId: allianceData.id });
        } catch (err) {
            setError('Failed to leave alliance.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateAllianceName = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!newAllianceNameInput.trim()) {
            setError('Alliance name cannot be empty.');
            return;
        }
        if (newAllianceNameInput.trim() === allianceDetails.name) {
            setError('New name is the same as the current name.');
            return;
        }
        setIsLoading(true);

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance);
        const oldName = allianceDetails.name;

        try {
            const batch = writeBatch(db);
            batch.update(allianceRef, { name: newAllianceNameInput.trim() });

            const usersAllianceGameDocsQuery = query(collection(db, 'users'), where('alliance', '==', playerAlliance));
            const usersSnapshot = await getDocs(usersAllianceGameDocsQuery);
            for (const userDoc of usersSnapshot.docs) {
                const gameDocRef = doc(db, `users/${userDoc.id}/games`, worldId);
                batch.update(gameDocRef, { allianceName: newAllianceNameInput.trim() });
            }

            const citySlotsToUpdateQuery = query(collection(db, 'worlds', worldId, 'citySlots'), where('alliance', '==', playerAlliance));
            const citySlotsSnapshot = await getDocs(citySlotsToUpdateQuery);
            for (const citySlotDoc of citySlotsSnapshot.docs) {
                 batch.update(doc(db, 'worlds', worldId, 'citySlots', citySlotDoc.id), { allianceName: newAllianceNameInput.trim() });
            }

            await batch.commit();
            setAllianceDetails(prev => ({ ...prev, name: newAllianceNameInput.trim() }));
            showSuccessMessage('Alliance name updated successfully!');
            logAllianceEvent(allianceDetails.id, 'name_change', `${currentUser.displayName || currentUser.email} changed the alliance name from "${oldName}" to "${newAllianceNameInput.trim()}".`, { oldName, newName: newAllianceNameInput.trim() });
        } catch (err) {
            setError('Failed to update alliance name.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateAllianceDescription = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance);
        const oldDescription = allianceDetails.description; // Capture old description

        try {
            await updateDoc(allianceRef, { description: allianceDescription.trim() });
            setAllianceDetails(prev => ({ ...prev, description: allianceDescription.trim() }));
            showSuccessMessage('Alliance description updated successfully!');
            logAllianceEvent(allianceDetails.id, 'description_change', `${currentUser.displayName || currentUser.email} updated the alliance description.`, { oldDescription, newDescription: allianceDescription.trim() });
        } catch (err) {
            setError('Failed to update alliance description.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        if (!playerAlliance) {
            return (
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
                                disabled={isLoading}
                            />
                            <button type="submit" disabled={isLoading} className="btn btn-primary py-2">
                                {isLoading ? 'Creating...' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            );
        }

        switch (activeTab) {
            case 'overview':
                return (
                    <div>
                        <h4 className="text-2xl font-bold text-yellow-400">{allianceDetails?.name || 'Loading...'}</h4>
                        <p className="text-gray-400">Leader: {allianceDetails?.leader === currentUser.uid ? 'You' : 'Unknown'}</p>
                        <p className="text-gray-400">Members: {allianceDetails?.members?.length || 0}</p>
                        <div className="mt-4">
                            <h5 className="text-lg font-bold text-yellow-300">Description</h5>
                            {allianceDetails?.leader === currentUser.uid ? (
                                <form onSubmit={handleUpdateAllianceDescription} className="flex flex-col gap-2 mt-2">
                                    <textarea
                                        value={allianceDescription}
                                        onChange={(e) => setAllianceDescription(e.target.value)}
                                        placeholder="Write your alliance description here..."
                                        className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white h-24"
                                        disabled={isLoading}
                                    ></textarea>
                                    <button type="submit" disabled={isLoading} className="btn btn-confirm py-2">
                                        {isLoading ? 'Saving...' : 'Save Description'}
                                    </button>
                                </form>
                            ) : (
                                <p className="text-gray-300 mt-2 whitespace-pre-wrap">{allianceDetails?.description || 'No description provided.'}</p>
                            )}
                        </div>

                        <div className="mt-6 border-t border-gray-700 pt-4">
                            <h5 className="text-lg font-bold text-yellow-300 mb-3">Alliance Events</h5>
                            <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {allianceEvents.length > 0 ? (
                                    allianceEvents.map(event => (
                                        <li key={event.id} className="bg-gray-700 p-2 rounded text-sm text-gray-300">
                                            <span>{event.message}</span>
                                            <span className="block text-xs text-gray-500">{event.timestamp?.toDate().toLocaleString()}</span>
                                        </li>
                                    ))
                                ) : (
                                    <p className="text-gray-400 text-center">No recent events.</p>
                                )}
                            </ul>
                        </div>
                    </div>
                );
            case 'members':
                return (
                    <div>
                        <h4 className="text-2xl font-bold text-yellow-400 mb-4">Members List</h4>
                        <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {allianceMembersData.length > 0 ? (
                                allianceMembersData.map(member => (
                                    <li key={member.id} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                                        <span>{member.username} {member.id === allianceDetails?.leader ? '(Leader)' : ''}</span>
                                    </li>
                                ))
                            ) : (
                                <p className="text-gray-400">Loading members or no members found.</p>
                            )}
                        </ul>
                    </div>
                );
            case 'properties':
                return (
                    <div>
                        <h4 className="text-2xl font-bold text-yellow-400 mb-4">Alliance Properties</h4>
                        {allianceDetails?.leader === currentUser.uid ? (
                            <>
                                <form onSubmit={handleUpdateAllianceName} className="flex flex-col gap-2">
                                    <label htmlFor="allianceName" className="text-gray-400 text-left">Alliance Name:</label>
                                    <input
                                        type="text"
                                        id="allianceName"
                                        value={newAllianceNameInput}
                                        onChange={(e) => setNewAllianceNameInput(e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                                        disabled={isLoading}
                                    />
                                    <button type="submit" disabled={isLoading} className="btn btn-confirm py-2">
                                        {isLoading ? 'Saving...' : 'Save Name'}
                                    </button>
                                </form>
                                <button onClick={handleLeaveAlliance} disabled={isLoading} className="btn btn-danger w-full mt-4 py-2">
                                    {isLoading ? 'Leaving...' : 'Leave Alliance'}
                                </button>
                            </>
                        ) : (
                            <p className="text-red-400 text-center">Only the alliance leader can change properties.</p>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl">Alliance</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {/* Display error message */}
                {error && <p className="text-red-400 text-center mb-4">{error}</p>}
                {/* Display success message */}
                {successMessage && <p className="text-green-400 text-center mb-4">{successMessage}</p>}
                
                {playerAlliance && (
                    <div className="flex border-b border-gray-600 mb-4">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 p-2 text-sm font-bold transition-colors ${activeTab === 'overview' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('members')}
                            className={`flex-1 p-2 text-sm font-bold transition-colors ${activeTab === 'members' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Members
                        </button>
                        {allianceDetails?.leader === currentUser.uid && (
                            <button
                                onClick={() => setActiveTab('properties')}
                                className={`flex-1 p-2 text-sm font-bold transition-colors ${activeTab === 'properties' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                            >
                                Properties
                            </button>
                        )}
                    </div>
                )}
                
                {renderContent()}
            </div>
        </div>
    );
};

export default AllianceModal;