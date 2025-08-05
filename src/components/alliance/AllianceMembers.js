// src/components/alliance/AllianceMembers.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useGame } from '../../contexts/GameContext';
import { useCityState } from '../../hooks/useCityState';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const AllianceMembers = () => {
    const { playerAlliance } = useAlliance();
    const { worldId } = useGame();
    const { calculateTotalPoints } = useCityState(worldId); // We only need this function

    const [detailedMembers, setDetailedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'username', direction: 'ascending' });

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

                return {
                    ...member,
                    points: totalPoints,
                    cityCount: citiesList.length,
                };
            });

            const details = await Promise.all(memberDetailsPromises);
            setDetailedMembers(details);
            setLoading(false);
        };

        fetchMemberDetails();
    }, [playerAlliance, worldId, calculateTotalPoints]);

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

    if (loading) {
        return <div>Loading member data...</div>;
    }

    return (
        <div>
            <h3 className="text-xl font-bold mb-2">Members ({playerAlliance.members.length})</h3>
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
                    </tr>
                </thead>
                <tbody>
                    {sortedMembers.map(member => (
                        <tr key={member.uid} className="border-b border-gray-300 text-gray-900">
                            <td className="p-2">{member.username}</td>
                            <td className="p-2">{member.rank}</td>
                            <td className="p-2 text-right">{member.points.toLocaleString()}</td>
                            <td className="p-2 text-right">{member.cityCount}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AllianceMembers;
