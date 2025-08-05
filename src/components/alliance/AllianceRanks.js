import React, { useState, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';

const AllianceRanks = ({ alliance, isLeader }) => {
    const { createAllianceRank, updateAllianceMemberRank } = useAlliance();
    const [newRankName, setNewRankName] = useState('');
    const [newRankPermissions, setNewRankPermissions] = useState({
        manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, recommendResearch: false
    });
    const [message, setMessage] = useState('');

    const allPermissions = Object.keys(newRankPermissions);
    
    const handleCreateRank = () => {
        if (!isLeader) return;
        if (newRankName.trim() === '') {
            setMessage('Rank name cannot be empty.');
            return;
        }
        if (alliance.ranks.length >= 6) {
            setMessage('Maximum of 6 ranks reached.');
            return;
        }

        createAllianceRank({
            id: newRankName.trim(),
            name: newRankName.trim(),
            permissions: newRankPermissions,
        });

        setNewRankName('');
        setNewRankPermissions({
            manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, recommendResearch: false
        });
        setMessage('Rank created!');
    };

    const handleUpdateMemberRank = (memberId, newRankId) => {
        if (!isLeader) return;
        updateAllianceMemberRank(memberId, newRankId);
    };

    // #comment Generates a comma-separated string of permissions for the tooltip
    const getPermissionsText = (permissions) => {
        const enabledPermissions = Object.entries(permissions || {})
            .filter(([, value]) => value)
            .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());
        
        if (enabledPermissions.length === 0) {
            return 'No special permissions.';
        }
        return `Permissions: ${enabledPermissions.join(', ')}`;
    };

    const sortedMembers = useMemo(() => {
        return [...(alliance.members || [])].sort((a, b) => {
            if (a.rank === 'Leader') return -1;
            if (b.rank === 'Leader') return 1;
            return a.username.localeCompare(b.username);
        });
    }, [alliance.members]);

     return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Alliance Ranks</h3>
            {!isLeader && <p className="text-red-600 mb-4">Only the leader can manage ranks.</p>}
            
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-lg mb-2 text-gray-900">Current Ranks</h4>
                    <ul className="space-y-2">
                        {alliance.ranks.map(rank => (
                            <li 
                                key={rank.id} 
                                className="bg-white text-gray-900 p-3 rounded border border-amber-200"
                                title={getPermissionsText(rank.permissions)}
                            >
                                <p className="font-bold">{rank.name}</p>
                                <p className="text-xs text-amber-800 mt-1">
                                    {getPermissionsText(rank.permissions)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>

                {isLeader && alliance.ranks.length < 6 && (
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <h4 className="font-semibold text-lg mb-2 text-gray-900">Create New Rank</h4>
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={newRankName}
                                onChange={(e) => setNewRankName(e.target.value)}
                                placeholder="New Rank Name"
                                className="w-full bg-white text-gray-900 p-2 rounded border border-amber-300"
                            />
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {allPermissions.map(perm => (
                                    <div key={perm} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={perm}
                                            checked={newRankPermissions[perm]}
                                            onChange={(e) => setNewRankPermissions(prev => ({ ...prev, [perm]: e.target.checked }))}
                                            className="mr-2"
                                        />
                                        <label htmlFor={perm} className="capitalize text-gray-900">
                                            {perm.replace(/([A-Z])/g, ' $1')}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={handleCreateRank} 
                                className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white w-full"
                            >
                                Create Rank
                            </button>
                        </div>
                    </div>
                )}
                
                {message && <p className="text-green-700 mt-2 text-sm">{message}</p>}

                <div className="mt-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-semibold text-lg mb-2 text-gray-900">Assign Ranks</h4>
                    <ul className="space-y-2">
                        {sortedMembers.map(member => (
                            <li key={member.uid} className="flex justify-between items-center bg-white text-gray-900 p-2 rounded border border-amber-200">
                                <span>{member.username}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-amber-800">{member.rank}</span>
                                    {isLeader && member.uid !== alliance.leader.uid && (
                                        <select
                                            value={member.rank}
                                            onChange={(e) => handleUpdateMemberRank(member.uid, e.target.value)}
                                            className="bg-white text-gray-900 p-1 rounded text-sm border border-amber-300"
                                        >
                                            {alliance.ranks.map(rank => (
                                                <option key={rank.id} value={rank.id}>{rank.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AllianceRanks;