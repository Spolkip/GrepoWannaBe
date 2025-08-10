// src/components/alliance/AllianceMembers.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useGame } from '../../contexts/GameContext';
import { useCityState } from '../../hooks/useCityState';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import allianceResearch from '../../gameData/allianceResearch.json';
import { useAuth } from '../../contexts/AuthContext';

const AllianceMembers = () => {
    const { playerAlliance } = useAlliance();
    const { worldId } = useGame();
    const { currentUser } = useAuth();
    const { calculateTotalPoints } = useCityState(worldId);

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
                const citiesColRef = collection(db, `users/${member.uid}/games`, worldId, 'cities');
                const citiesSnap = await getDocs(citiesColRef);
                const citiesList = citiesSnap.docs.map(doc => doc.data());

                let totalPoints = 0;
                for (const city of citiesList) {
                    totalPoints += calculateTotalPoints(city);
                }

                // #comment Fetch lastLogin and lastSeen if permission is granted
                let lastLogin = null;
                let lastSeen = null;
                if (canViewActivity) {
                    const userDocRef = doc(db, 'users', member.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        lastLogin = userDocSnap.data().lastLogin?.toDate() || null;
                        lastSeen = userDocSnap.data().lastSeen?.toDate() || null;
                    }
                }

                return {
                    ...member,
                    points: totalPoints,
                    cityCount: citiesList.length,
                    lastLogin: lastLogin,
                    lastSeen: lastSeen,
                };
            });

            const details = await Promise.all(memberDetailsPromises);
            setDetailedMembers(details);
            setLoading(false);
        };

        fetchMemberDetails();
    }, [playerAlliance, worldId, calculateTotalPoints, canViewActivity]);

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
                    const aIsOnline = a.lastSeen && (new Date() - a.lastSeen) < 5 * 60 * 1000;
                    const bIsOnline = b.lastSeen && (new Date() - b.lastSeen) < 5 * 60 * 1000;
                    if (aIsOnline && !bIsOnline) return -1;
                    if (!aIsOnline && bIsOnline) return 1;
                    aValue = b.lastSeen || 0; // Sort by most recent seen
                    bValue = a.lastSeen || 0;
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

    // #comment Helper function to format the last login time
    const formatLastSeen = (date) => {
        if (!date) return 'Unknown';
        const now = new Date();
        const diffSeconds = Math.round((now - date) / 1000);
        
        if (diffSeconds < 5 * 60) return <span className="text-green-500 font-bold">Online</span>;

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
                                <td className="p-2 text-right">{formatLastSeen(member.lastSeen)}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AllianceMembers;
