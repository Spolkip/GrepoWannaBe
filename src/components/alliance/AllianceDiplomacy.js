import React from 'react';
import { useGame } from '../../contexts/GameContext';

const AllianceDiplomacy = () => {
    const { playerAlliance } = useGame();

    return (
        <div>
            <h3 className="text-xl font-bold mb-2">Diplomacy</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="font-bold">Allies</h4>
                    <ul>
                        {playerAlliance.diplomacy?.allies?.map(ally => <li key={ally.id}>{ally.name}</li>) || <li>None</li>}
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold">Enemies</h4>
                    <ul>
                        {playerAlliance.diplomacy?.enemies?.map(enemy => <li key={enemy.id}>{enemy.name}</li>) || <li>None</li>}
                    </ul>
                </div>
            </div>
            {/* Add forms for leaders to manage diplomacy */}
        </div>
    );
};

export default AllianceDiplomacy;
