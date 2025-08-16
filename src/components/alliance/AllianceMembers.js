// src/components/alliance/AllianceMembers.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600 text-white">
            <p className="mb-6 text-lg">{message}</p>
            <div className="flex justify-center space-x-4">
                <button onClick={onCancel} className="btn btn-primary">Cancel</button>
                <button onClick={onConfirm} className="btn btn-danger">Confirm</button>
            </div>
        </div>
    </div>
);

const AllianceMembers = () => {
    const { playerAlliance, kickAllianceMember, banAllianceMember, updateAllianceMemberRank } = useAlliance();
    const { worldId } = useGame();
    const { currentUser } = useAuth();

    const [detailedMembers, setDetailedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'username', direction: 'ascending' });
    const [confirmAction, setConfirmAction] = useState(null);
    const [message, setMessage] = useState('');
    const [editingMemberId, setEditingMemberId] = useState(null);
    const [openManageMenu, setOpenManageMenu] = useState(null);
    const manageMenuRef = useRef(null);

    const memberRankData = useMemo(() => {
        if (!playerAlliance || !currentUser) return null;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) return null;
        return playerAlliance.ranks.find(r => r.id === member.rank);
    }, [playerAlliance, currentUser]);

    const canKickMembers = memberRankData?.permissions?.kickMembers;
    const canBanMembers = memberRankData?.permissions?.banMembers;
    const canViewActivity = memberRankData?.permissions?.viewMemberActivity;
    const canManageRanks = memberRankData?.permissions?.manageRanks;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (manageMenuRef.current && !manageMenuRef.current.contains(event.target)) {
                setOpenManageMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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
            memberCache[playerAlliance.id] = {
                data: details,
                timestamp: Date.now(),
            };
            setLoading(false);
        };

        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;
        const allianceId = playerAlliance?.id;

        if (allianceId && memberCache[allianceId] && (now - memberCache[allianceId].timestamp < twoMinutes)) {
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

                if (sortConfig.key === 'rank') {
                    aValue = playerAlliance.ranks.findIndex(r => r.id === a.rank);
                    bValue = playerAlliance.ranks.findIndex(r => r.id === b.rank);
                }
                
                if (sortConfig.key === 'status') {
                    const aIsOnline = a.lastSeen && (new Date() - a.lastSeen) < 5 * 60 * 1000;
                    const bIsOnline = b.lastSeen && (new Date() - b.lastSeen) < 5 * 60 * 1000;
                    if (aIsOnline && !bIsOnline) return -1;
                    if (!aIsOnline && bIsOnline) return 1;
                    aValue = b.lastSeen || b.lastLogin || 0;
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

    const formatLastSeen = (lastSeen, lastLogin) => {
        const now = new Date();

        if (lastSeen && (now - lastSeen) < 5 * 60 * 1000) {
            return <span className="text-green-500 font-bold">Online</span>;
        }

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

    const handleKick = (member) => {
        setOpenManageMenu(null);
        setConfirmAction({
            message: `Are you sure you want to kick ${member.username} from the alliance?`,
            onConfirm: async () => {
                try {
                    await kickAllianceMember(member.uid);
                    setMessage(`${member.username} has been kicked.`);
                } catch (error) {
                    setMessage(`Error: ${error.message}`);
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    const handleBan = (member) => {
        setOpenManageMenu(null);
        setConfirmAction({
            message: `Are you sure you want to ban ${member.username}? This will kick them and prevent them from rejoining.`,
            onConfirm: async () => {
                try {
                    await banAllianceMember(member.uid);
                    setMessage(`${member.username} has been banned.`);
                } catch (error) {
                    setMessage(`Error: ${error.message}`);
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    const handleUpdateMemberRank = async (memberId, newRankId) => {
        try {
            await updateAllianceMemberRank(memberId, newRankId);
            setMessage('Member rank updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage('Failed to update rank. Please try again.');
            console.error('Error updating member rank:', error);
        }
    };

    if (loading) {
        return <div>Loading member data...</div>;
    }

    return (
        <div>
            {confirmAction && (
                <ConfirmationModal
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <h3 className="text-xl font-bold mb-2">Members ({playerAlliance.members.length} / {maxMembers})</h3>
            {message && <p className="text-center text-yellow-400 mb-2">{message}</p>}
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
                        {(canKickMembers || canBanMembers) && <th className="p-2 text-right">Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {sortedMembers.map(member => (
                        <tr key={member.uid} className="border-b border-gray-300 text-gray-900">
                            <td className="p-2">{member.username}</td>
                            <td className="p-2">
                                {canManageRanks && member.uid !== playerAlliance.leader.uid ? (
                                    editingMemberId === member.uid ? (
                                        <select
                                            value={member.rank}
                                            onChange={(e) => {
                                                handleUpdateMemberRank(member.uid, e.target.value);
                                                setEditingMemberId(null);
                                            }}
                                            onBlur={() => setEditingMemberId(null)}
                                            autoFocus
                                            className="bg-white text-gray-900 p-1 rounded text-sm border border-amber-300"
                                        >
                                            {playerAlliance.ranks.map(rank => (
                                                <option key={rank.id} value={rank.id}>{rank.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <button
                                            onClick={() => setEditingMemberId(member.uid)}
                                            className="text-sm text-amber-800 hover:underline cursor-pointer bg-transparent border-none p-0"
                                        >
                                            {member.rank}
                                        </button>
                                    )
                                ) : (
                                    member.rank
                                )}
                            </td>
                            <td className="p-2 text-right">{member.points.toLocaleString()}</td>
                            <td className="p-2 text-right">{member.cityCount}</td>
                            {canViewActivity && (
                                <td className="p-2 text-right">{formatLastSeen(member.lastSeen, member.lastLogin)}</td>
                            )}
                            {(canKickMembers || canBanMembers) && (
                                <td className="p-2 text-right relative">
                                    {member.uid !== currentUser.uid && member.uid !== playerAlliance.leader.uid && (
                                        <button onClick={() => setOpenManageMenu(openManageMenu === member.uid ? null : member.uid)} className="btn btn-primary text-xs px-2 py-1">
                                            Manage
                                        </button>
                                    )}
                                    {openManageMenu === member.uid && (
                                        <div ref={manageMenuRef} className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                            {canKickMembers && <button onClick={() => handleKick(member)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Kick</button>}
                                            {canBanMembers && <button onClick={() => handleBan(member)} className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50">Ban</button>}
                                        </div>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AllianceMembers;
