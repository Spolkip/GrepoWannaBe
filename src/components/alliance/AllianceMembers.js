import React from 'react';
import { useAlliance } from '../../contexts/AllianceContext';

const AllianceMembers = () => {
    const { playerAlliance } = useAlliance();

    return (
        <div>
            <h3 className="text-xl font-bold mb-2">Members</h3>
            <ul>
                {playerAlliance.members.map(member => (
                    <li key={member.uid} className="flex justify-between items-center bg-gray-200 alliance-text-light p-2 rounded mb-1">
                    <span>{member.username}</span>
                    <span>{member.rank}</span>
                </li>
                ))}
            </ul>
        </div>
    );
};

export default AllianceMembers;