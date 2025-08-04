import React, { useState } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';

const AllianceDiplomacy = () => {
    const { playerAlliance, sendAllyRequest, declareEnemy, handleDiplomacyResponse } = useAlliance();
    const [targetTag, setTargetTag] = useState('');
    const [message, setMessage] = useState('');

    const handleRequest = async () => {
        if (!targetTag.trim()) return;
        setMessage('');
        try {
            await sendAllyRequest(targetTag.trim().toUpperCase());
            setMessage(`Ally request sent to [${targetTag.trim().toUpperCase()}]`);
            setTargetTag('');
        } catch (error) {
            setMessage(error.message);
        }
    };

    const handleDeclareEnemy = async () => {
        if (!targetTag.trim()) return;
        setMessage('');
        try {
            await declareEnemy(targetTag.trim().toUpperCase());
            setMessage(`[${targetTag.trim().toUpperCase()}] has been declared as an enemy.`);
            setTargetTag('');
        } catch (error) {
            setMessage(error.message);
        }
    };

    const handleResponse = async (targetAllianceId, action) => {
        setMessage('');
        try {
            await handleDiplomacyResponse(targetAllianceId, action);
            setMessage('Diplomatic status updated.');
        } catch (error) {
            setMessage(error.message);
        }
    };

    const diplomacy = playerAlliance.diplomacy || {};
    const requests = diplomacy.requests || [];
    const allies = diplomacy.allies || [];
    const enemies = diplomacy.enemies || [];

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Diplomacy</h3>
            
            <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <h4 className="font-bold mb-2">Make a Declaration</h4>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={targetTag}
                        onChange={(e) => setTargetTag(e.target.value)}
                        placeholder="Enter Alliance Tag"
                        className="w-full bg-gray-900 p-2 rounded"
                        maxLength="5"
                    />
                    <button onClick={handleRequest} className="btn btn-confirm">Ally Request</button>
                    <button onClick={handleDeclareEnemy} className="btn btn-danger">Declare Enemy</button>
                </div>
                {message && <p className="text-sm mt-2 text-yellow-300">{message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <h4 className="font-bold mb-2">Incoming Requests</h4>
                    <ul className="space-y-2">
                        {requests.length > 0 ? requests.map(req => (
                            <li key={req.id} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                                <span>{req.name} [{req.tag}]</span>
                                <div className="flex gap-1">
                                    <button onClick={() => handleResponse(req.id, 'accept')} className="btn btn-confirm text-xs px-2 py-1">✓</button>
                                    <button onClick={() => handleResponse(req.id, 'reject')} className="btn btn-danger text-xs px-2 py-1">✗</button>
                                </div>
                            </li>
                        )) : <li className="text-gray-400 italic">None</li>}
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold mb-2">Allies</h4>
                    <ul className="space-y-2">
                        {allies.length > 0 ? allies.map(ally => (
                            <li key={ally.id} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                                <span>{ally.name} [{ally.tag}]</span>
                                <button onClick={() => handleResponse(ally.id, 'removeAlly')} className="btn btn-danger text-xs px-2 py-1">Remove</button>
                            </li>
                        )) : <li className="text-gray-400 italic">None</li>}
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold mb-2">Enemies</h4>
                    <ul className="space-y-2">
                        {enemies.length > 0 ? enemies.map(enemy => (
                            <li key={enemy.id} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                                <span>{enemy.name} [{enemy.tag}]</span>
                                <button onClick={() => handleResponse(enemy.id, 'removeEnemy')} className="btn btn-primary text-xs px-2 py-1">Remove</button>
                            </li>
                        )) : <li className="text-gray-400 italic">None</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AllianceDiplomacy;