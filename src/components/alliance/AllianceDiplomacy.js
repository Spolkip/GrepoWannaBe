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
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Diplomacy</h3>
            
            <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
                <h4 className="font-bold mb-2 text-gray-900">Make a Declaration</h4>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={targetTag}
                        onChange={(e) => setTargetTag(e.target.value)}
                        placeholder="Enter Alliance Tag"
                        className="w-full bg-white text-gray-900 p-2 rounded border border-amber-300"
                        maxLength="5"
                    />
                    <button 
                        onClick={handleRequest} 
                        className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white"
                    >
                        Ally Request
                    </button>
                    <button 
                        onClick={handleDeclareEnemy} 
                        className="btn btn-danger bg-red-600 hover:bg-red-700 text-white"
                    >
                        Declare Enemy
                    </button>
                </div>
                {message && <p className="text-sm mt-2 text-amber-800">{message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Incoming Requests */}
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Incoming Requests</h4>
                    <ul className="space-y-2">
                        {requests.length > 0 ? requests.map(req => (
                            <li key={req.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                <span>{req.name} [{req.tag}]</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleResponse(req.id, 'accept')} 
                                        className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                                    >
                                        ✓
                                    </button>
                                    <button 
                                        onClick={() => handleResponse(req.id, 'reject')} 
                                        className="btn btn-danger bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                                    >
                                        ✗
                                    </button>
                                </div>
                            </li>
                        )) : <li className="text-amber-800 italic">None</li>}
                    </ul>
                </div>
                
                {/* Allies */}
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Allies</h4>
                    <ul className="space-y-2">
                        {allies.length > 0 ? allies.map(ally => (
                            <li key={ally.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                <span>{ally.name} [{ally.tag}]</span>
                                <button 
                                    onClick={() => handleResponse(ally.id, 'removeAlly')} 
                                    className="btn btn-danger bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                                >
                                    Remove
                                </button>
                            </li>
                        )) : <li className="text-amber-800 italic">None</li>}
                    </ul>
                </div>
                
                {/* Enemies */}
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Enemies</h4>
                    <ul className="space-y-2">
                        {enemies.length > 0 ? enemies.map(enemy => (
                            <li key={enemy.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                <span>{enemy.name} [{enemy.tag}]</span>
                                <button 
                                    onClick={() => handleResponse(enemy.id, 'removeEnemy')} 
                                    className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1"
                                >
                                    Remove
                                </button>
                            </li>
                        )) : <li className="text-amber-800 italic">None</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AllianceDiplomacy;