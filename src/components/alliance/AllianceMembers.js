// src/components/alliance/AllianceMembers.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import allianceResearch from '../../gameData/allianceResearch.json';
import { useAuth } from '../../contexts/AuthContext';

// #comment Cache for alliance member data.
const memberCache = {};

// #comment Function to clear the member cache, exported for admin use.
export const clearMemberCache = () => {
    for (const key in memberCache) {
        delete memberCache[key];
    }
};

const AllianceMembers = () => {
    const { playerAlliance } = useAlliance();
    const { worldId } = useGame();
    const { currentUser } = useAuth();

    const [detailedMembers, setDetailedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'username', direction: 'ascending' });

    // #comment Check if the current user has permission to view member activity
    const canViewActivity = useMemo(() => {
        if (!playerAlliance || !currentUser) return false;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) return false;
        const rank = playerAlliance.ranks.find(r => r.id === member.rank);
        return rank?.permissions?.viewMemberActivity || false;
    }, [playerAlliance, currentUser]);

    // #comment Calculate max members based on research
    const maxMembers = useMemo(() => {
        if (!playerAlliance) return 0;
        const baseMax = 20;
        const researchLevel = playerAlliance.research?.expanded_charter?.level || 0;
        const researchBonus = allianceResearch.expanded_charter.effect.value * researchLevel;
        return baseMax + researchBonus;
    }, [playerAlliance]);

    useEffect(() => {
        const fetchMemberDetails = async () => {
            if (!playerAlliance || playerAlliance.members.length === 0) {
                setLoading(false);
                return;
            }
            setLoading(true);

            const memberDetailsPromises = playerAlliance.members.map(async (member) => {
                const gameDocRef = doc(db, `users/${member.uid}/games`, worldId);
                const userDocRef = doc(db, 'users', member.uid);

                const [gameDocSnap, userDocSnap] = await Promise.all([
                    getDoc(gameDocRef),
                    canViewActivity ? getDoc(userDocRef) : Promise.resolve(null)
                ]);

                const gameData = gameDocSnap.exists() ? gameDocSnap.data() : { totalPoints: 0, cityCount: 0, lastSeen: null };
                const userData = userDocSnap?.exists() ? userDocSnap.data() : {};

                return {
                    ...member,
                    points: gameData.totalPoints || 0,
                    cityCount: gameData.cityCount || 0,
                    lastSeen: gameData.lastSeen?.toDate() || null,
                    lastLogin: userData.lastLogin?.toDate() || null,
                };
            });

            const details = await Promise.all(memberDetailsPromises);
            setDetailedMembers(details);
            // #comment Update cache
            memberCache[playerAlliance.id] = {
                data: details,
                timestamp: Date.now(),
            };
            setLoading(false);
        };

        const now = Date.now();
        const twentyMinutes = 20 * 60 * 1000;
        const allianceId = playerAlliance?.id;

        if (allianceId && memberCache[allianceId] && (now - memberCache[allianceId].timestamp < twentyMinutes)) {
            setDetailedMembers(memberCache[allianceId].data);
            setLoading(false);
        } else {
            fetchMemberDetails();
        }
    }, [playerAlliance, worldId, canViewActivity]);

    const sortedMembers = useMemo(() => {
        let sortableItems = [...detailedMembers];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // #comment Special case for rank sorting based on its order in the ranks array
                if (sortConfig.key === 'rank') {
                    aValue = playerAlliance.ranks.findIndex(r => r.id === a.rank);
                    bValue = playerAlliance.ranks.findIndex(r => r.id === b.rank);
                }
                
                // #comment Special case for status sorting (online first)
                if (sortConfig.key === 'status') {
                    const aIsOnline = a.lastSeen && (new Date() - a.lastSeen) < 3.25 * 60 * 1000; // Tighter window
                    const bIsOnline = b.lastSeen && (new Date() - b.lastSeen) < 3.25 * 60 * 1000; // Tighter window
                    if (aIsOnline && !bIsOnline) return -1;
                    if (!aIsOnline && bIsOnline) return 1;
                    aValue = b.lastSeen || b.lastLogin || 0; // Sort by most recent activity
                    bValue = a.lastSeen || a.lastLogin || 0;
                }


                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [detailedMembers, sortConfig, playerAlliance.ranks]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
        }
        return '';
    };

    // #comment Helper function to format the last seen/login time
    const formatLastSeen = (lastSeen, lastLogin) => {
        const now = new Date();

        // Player is currently online if lastSeen is recent
        if (lastSeen && (now - lastSeen) < 3.25 * 60 * 1000) { // Tighter 3.25 minute window
            return <span className="text-green-500 font-bold">Online</span>;
        }

        // Use lastSeen if available, otherwise fallback to lastLogin for offline status
        const date = lastSeen || lastLogin;

        if (!date || !(date instanceof Date)) {
            return <span className="text-gray-500">Offline</span>;
        }

        const diffSeconds = Math.round((now - date) / 1000);
        
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return <div>Loading member data...</div>;
    }

    return (
        <div>
            <h3 className="text-xl font-bold mb-2">Members ({playerAlliance.members.length} / {maxMembers})</h3>
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-gray-300 text-gray-900">
                        <th className="p-2 cursor-pointer" onClick={() => requestSort('username')}>
                            Player{getSortIndicator('username')}
                        </th>
                        <th className="p-2 cursor-pointer" onClick={() => requestSort('rank')}>
                            Rank{getSortIndicator('rank')}
                        </th>
                        <th className="p-2 cursor-pointer text-right" onClick={() => requestSort('points')}>
                            Points{getSortIndicator('points')}
                        </th>
                        <th className="p-2 cursor-pointer text-right" onClick={() => requestSort('cityCount')}>
                            Cities{getSortIndicator('cityCount')}
                        </th>
                        {canViewActivity && (
                            <th className="p-2 cursor-pointer text-right" onClick={() => requestSort('status')}>
                                Status{getSortIndicator('status')}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {sortedMembers.map(member => (
                        <tr key={member.uid} className="border-b border-gray-300 text-gray-900">
                            <td className="p-2">{member.username}</td>
                            <td className="p-2">{member.rank}</td>
                            <td className="p-2 text-right">{member.points.toLocaleString()}</td>
                            <td className="p-2 text-right">{member.cityCount}</td>
                            {canViewActivity && (
                                <td className="p-2 text-right">{formatLastSeen(member.lastSeen, member.lastLogin)}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AllianceMembers;
