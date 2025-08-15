// src/components/alliance/AllianceSuggestions.js
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';

// #comment Cache for alliance suggestions to reduce reads.
const suggestionsCache = {
    alliances: null,
    timestamp: 0,
};

export const clearSuggestionsCache = () => {
    suggestionsCache.alliances = null;
    suggestionsCache.timestamp = 0;
};

const AllianceSuggestions = ({ onAllianceClick, onOpenCreate }) => {
    const { worldId, worldState } = useGame();
    const { applyToAlliance, joinOpenAlliance } = useAlliance();
    const [alliances, setAlliances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(''); // State for user feedback

    useEffect(() => {
        const fetchAlliances = async () => {
            if (!worldId || !worldState) return;
            setLoading(true);

            const now = Date.now();
            const CACHE_DURATION = 1 * 60 * 1000; // 5 minutes

            if (now - suggestionsCache.timestamp < CACHE_DURATION && suggestionsCache.alliances) {
                setAlliances(suggestionsCache.alliances);
                setLoading(false);
                return;
            }

            // #comment Step 1: Efficiently get all player points using a collection group query.
            const gamesGroupRef = collectionGroup(db, 'games');
            const gamesQuery = query(gamesGroupRef, where('worldName', '==', worldState.name));
            const gamesSnapshot = await getDocs(gamesQuery);

            const playerPointsMap = new Map();
            gamesSnapshot.forEach(gameDoc => {
                const userId = gameDoc.ref.parent.parent.id;
                playerPointsMap.set(userId, gameDoc.data().totalPoints || 0);
            });


            // #comment Step 2: Fetch only the alliances that can be joined.
            const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
            const q = query(alliancesRef, where('settings.status', 'in', ['open', 'invite_only']));
            const snapshot = await getDocs(q);
            
            // #comment Step 3: Map alliances and sum points using the pre-fetched map. This avoids N+1 reads.
            const alliancesData = snapshot.docs.map((doc) => {
                const alliance = { id: doc.id, ...doc.data() };
                let totalPoints = 0;
                for (const member of alliance.members) {
                    totalPoints += playerPointsMap.get(member.uid) || 0;
                }
                return { ...alliance, totalPoints };
            });

            setAlliances(alliancesData);
            suggestionsCache.alliances = alliancesData;
            suggestionsCache.timestamp = now;
            setLoading(false);
        };
        fetchAlliances();
    }, [worldId, worldState]);

    const handleAction = async (alliance) => {
        setMessage(''); // Clear previous messages
        try {
            if (alliance.settings.status === 'open') {
                await joinOpenAlliance(alliance.id);
                // No need to set a message here, as the component will unmount on success
            } else {
                await applyToAlliance(alliance.id);
                setMessage(`Application sent to ${alliance.name}!`);
            }
        } catch (error) {
            console.error("Error performing alliance action:", error);
            setMessage(`Action failed: ${error.message}`); // Show error to user
        }
    };

    if (loading) {
        return <div className="text-center p-4">Loading alliances...</div>;
    }

    return (
        <div className="text-gray-900">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Available Alliances</h3>
                <button onClick={onOpenCreate} className="btn btn-primary">Create Your Own</button>
            </div>
            {message && <p className="text-center p-2 bg-yellow-200 rounded mb-4">{message}</p>}
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-gray-300">
                        <th className="p-2">Tag</th>
                        <th className="p-2">Name</th>
                        <th className="p-2 text-center">Members</th>
                        <th className="p-2 text-right">Points</th>
                        <th className="p-2 text-center">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {alliances.map(alliance => (
                        <tr key={alliance.id} className="border-b border-gray-300">
                            <td className="p-2 font-bold">[{alliance.tag}]</td>
                            <td className="p-2">
                                <button onClick={() => onAllianceClick(alliance.id)} className="font-bold text-blue-600 hover:underline">
                                    {alliance.name}
                                </button>
                            </td>
                            <td className="p-2 text-center">{alliance.members.length} / 25</td>
                            <td className="p-2 text-right">{alliance.totalPoints.toLocaleString()}</td>
                            <td className="p-2 text-center">
                                <button onClick={() => handleAction(alliance)} className="btn btn-confirm text-sm px-3 py-1">
                                    {alliance.settings.status === 'open' ? 'Join' : 'Apply'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AllianceSuggestions;
