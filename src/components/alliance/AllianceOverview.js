import React from 'react';
import { useGame } from '../../contexts/GameContext';

const AllianceOverview = () => {
    const { playerAlliance } = useGame();

    return (
        <div>
            <h3 className="text-xl font-bold mb-2">Alliance Description</h3>
            <p className="text-gray-400">{playerAlliance.description || 'No description provided.'}</p>
            {/* Add more overview details here, like total points, member count, etc. */}
        </div>
    );
};

export default AllianceOverview;
