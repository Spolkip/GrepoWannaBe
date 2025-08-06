import React, { useState, useEffect } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { db } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';

const AllianceDiplomacy = () => {
    const { playerAlliance, sendAllyRequest, declareEnemy, handleDiplomacyResponse, proposeTreaty } = useAlliance();
    const { worldId } = useGame();
    const [targetTag, setTargetTag] = useState('');
    const [message, setMessage] = useState('');

    // State for treaty proposals
    const [treatyTargetTag, setTreatyTargetTag] = useState('');
    const [offerType, setOfferType] = useState('resources');
    const [offerResources, setOfferResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [offerAllianceAction, setOfferAllianceAction] = useState('declare_war');
    const [offerTargetAlliance, setOfferTargetAlliance] = useState('');
    const [demandType, setDemandType] = useState('resources');
    const [demandResources, setDemandResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [demandAllianceAction, setDemandAllianceAction] = useState('declare_war');
    const [demandTargetAlliance, setDemandTargetAlliance] = useState('');
    const [frequency, setFrequency] = useState('once');
    const [occurrences, setOccurrences] = useState(1);
    const [treatyMessage, setTreatyMessage] = useState('');

    // Autocomplete states
    const [allAlliances, setAllAlliances] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [activeSuggestionInput, setActiveSuggestionInput] = useState(null);

    // Fetch all alliances for autocomplete
    useEffect(() => {
        if (!worldId) return;
        const fetchAlliances = async () => {
            const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
            const snapshot = await getDocs(alliancesRef);
            const alliances = snapshot.docs
                .map(doc => doc.data().tag)
                .filter(tag => tag !== playerAlliance.tag); // Exclude self
            setAllAlliances(alliances);
        };
        fetchAlliances();
    }, [worldId, playerAlliance.tag]);

    const handleInputChange = (value, fieldSetter, fieldName) => {
        fieldSetter(value);
        setActiveSuggestionInput(fieldName);
        if (value.length > 0) {
            const filteredSuggestions = allAlliances.filter(tag =>
                tag.toLowerCase().startsWith(value.toLowerCase())
            );
            setSuggestions(filteredSuggestions);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (tag) => {
        if (activeSuggestionInput === 'targetTag') setTargetTag(tag);
        if (activeSuggestionInput === 'treatyTargetTag') setTreatyTargetTag(tag);
        if (activeSuggestionInput === 'offerTargetAlliance') setOfferTargetAlliance(tag);
        if (activeSuggestionInput === 'demandTargetAlliance') setDemandTargetAlliance(tag);
        setSuggestions([]);
        setActiveSuggestionInput(null);
    };

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

    const handleProposeTreaty = async () => {
        if (!treatyTargetTag.trim()) {
            setMessage('Please enter a target alliance tag for the treaty.');
            return;
        }
        setMessage('');
        try {
            const details = {
                offer: offerType === 'resources' ? { type: 'resources', data: offerResources } : { type: 'alliance_action', action: offerAllianceAction, target: offerTargetAlliance },
                demand: demandType === 'resources' ? { type: 'resources', data: demandResources } : { type: 'alliance_action', action: demandAllianceAction, target: demandTargetAlliance },
                frequency,
                occurrences,
                message: treatyMessage,
            };
            await proposeTreaty(treatyTargetTag.trim().toUpperCase(), details);
            setMessage(`Treaty proposed to [${treatyTargetTag.trim().toUpperCase()}]`);
            setTreatyTargetTag('');
        } catch (error) {
            setMessage(`Failed to propose treaty: ${error.message}`);
        }
    };

    const diplomacy = playerAlliance.diplomacy || {};
    const requests = diplomacy.requests || [];
    const allies = diplomacy.allies || [];
    const enemies = diplomacy.enemies || [];

    return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Diplomacy</h3>
                <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Make a Declaration</h4>
                    <div className="flex gap-2 autocomplete-suggestions-container">
                        <input 
                            type="text"
                            value={targetTag}
                            onChange={(e) => handleInputChange(e.target.value, setTargetTag, 'targetTag')}
                            placeholder="Enter Alliance Tag"
                            className="w-full bg-white text-gray-900 p-2 rounded border border-amber-300"
                            maxLength="5"
                            autoComplete="off"
                        />
                        {suggestions.length > 0 && activeSuggestionInput === 'targetTag' && (
                            <ul className="autocomplete-suggestions-list light">
                                {suggestions.map(tag => (
                                    <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                        {tag}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button onClick={handleRequest} className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white">Ally Request</button>
                        <button onClick={handleDeclareEnemy} className="btn btn-danger bg-red-600 hover:bg-red-700 text-white">Declare Enemy</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold mb-2 text-gray-900">Incoming Requests</h4>
                        <ul className="space-y-2">
                            {requests.length > 0 ? requests.map(req => (
                                <li key={req.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                    <span>{req.name} [{req.tag}]</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleResponse(req.id, 'accept')} className="btn btn-confirm bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1">✓</button>
                                        <button onClick={() => handleResponse(req.id, 'reject')} className="btn btn-danger bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1">✗</button>
                                    </div>
                                </li>
                            )) : <li className="text-amber-800 italic">None</li>}
                        </ul>
                    </div>
                    
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold mb-2 text-gray-900">Allies</h4>
                        <ul className="space-y-2">
                            {allies.length > 0 ? allies.map(ally => (
                                <li key={ally.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                    <span>{ally.name} [{ally.tag}]</span>
                                    <button onClick={() => handleResponse(ally.id, 'removeAlly')} className="btn btn-danger bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1">Remove</button>
                                </li>
                            )) : <li className="text-amber-800 italic">None</li>}
                        </ul>
                    </div>
                    
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold mb-2 text-gray-900">Enemies</h4>
                        <ul className="space-y-2">
                            {enemies.length > 0 ? enemies.map(enemy => (
                                <li key={enemy.id} className="bg-white text-gray-900 p-2 rounded flex justify-between items-center border border-amber-200">
                                    <span>{enemy.name} [{enemy.tag}]</span>
                                    <button onClick={() => handleResponse(enemy.id, 'removeEnemy')} className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1">Remove</button>
                                </li>
                            )) : <li className="text-amber-800 italic">None</li>}
                        </ul>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Treaties</h3>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-bold mb-2 text-gray-900">Propose a Treaty</h4>
                    <div className="space-y-3 autocomplete-suggestions-container">
                        <input type="text" value={treatyTargetTag} onChange={(e) => handleInputChange(e.target.value, setTreatyTargetTag, 'treatyTargetTag')} placeholder="Target Alliance Tag" className="w-full p-2 rounded border border-amber-300" autoComplete="off" />
                        {suggestions.length > 0 && activeSuggestionInput === 'treatyTargetTag' && (
                            <ul className="autocomplete-suggestions-list light">
                                {suggestions.map(tag => (
                                    <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                        {tag}
                                    </li>
                                ))}
                            </ul>
                        )}
                        
                        <div className="border p-2 rounded">
                            <h5 className="font-semibold">You Offer:</h5>
                            <select value={offerType} onChange={(e) => setOfferType(e.target.value)}>
                                <option value="resources">Resources</option>
                                <option value="alliance_action">Alliance Action</option>
                            </select>
                            {offerType === 'resources' ? (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <input type="number" value={offerResources.wood} onChange={(e) => setOfferResources(prev => ({...prev, wood: parseInt(e.target.value) || 0}))} placeholder="Wood" />
                                    <input type="number" value={offerResources.stone} onChange={(e) => setOfferResources(prev => ({...prev, stone: parseInt(e.target.value) || 0}))} placeholder="Stone" />
                                    <input type="number" value={offerResources.silver} onChange={(e) => setOfferResources(prev => ({...prev, silver: parseInt(e.target.value) || 0}))} placeholder="Silver" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 mt-2 autocomplete-suggestions-container">
                                    <select value={offerAllianceAction} onChange={(e) => setOfferAllianceAction(e.target.value)}>
                                        <option value="declare_war">Declare War On</option>
                                        <option value="form_pact">Form Pact With</option>
                                    </select>
                                    <input type="text" value={offerTargetAlliance} onChange={(e) => handleInputChange(e.target.value, setOfferTargetAlliance, 'offerTargetAlliance')} placeholder="Target Alliance Tag" autoComplete="off"/>
                                    {suggestions.length > 0 && activeSuggestionInput === 'offerTargetAlliance' && (
                                        <ul className="autocomplete-suggestions-list light">
                                            {suggestions.map(tag => (
                                                <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                                    {tag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border p-2 rounded">
                            <h5 className="font-semibold">You Demand:</h5>
                            <select value={demandType} onChange={(e) => setDemandType(e.target.value)}>
                                <option value="resources">Resources</option>
                                <option value="alliance_action">Alliance Action</option>
                            </select>
                            {demandType === 'resources' ? (
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <input type="number" value={demandResources.wood} onChange={(e) => setDemandResources(prev => ({...prev, wood: parseInt(e.target.value) || 0}))} placeholder="Wood" />
                                    <input type="number" value={demandResources.stone} onChange={(e) => setDemandResources(prev => ({...prev, stone: parseInt(e.target.value) || 0}))} placeholder="Stone" />
                                    <input type="number" value={demandResources.silver} onChange={(e) => setDemandResources(prev => ({...prev, silver: parseInt(e.target.value) || 0}))} placeholder="Silver" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 mt-2 autocomplete-suggestions-container">
                                    <select value={demandAllianceAction} onChange={(e) => setDemandAllianceAction(e.target.value)}>
                                        <option value="declare_war">Declare War On</option>
                                        <option value="form_pact">Form Pact With</option>
                                    </select>
                                    <input type="text" value={demandTargetAlliance} onChange={(e) => handleInputChange(e.target.value, setDemandTargetAlliance, 'demandTargetAlliance')} placeholder="Target Alliance Tag" autoComplete="off"/>
                                    {suggestions.length > 0 && activeSuggestionInput === 'demandTargetAlliance' && (
                                        <ul className="autocomplete-suggestions-list light">
                                            {suggestions.map(tag => (
                                                <li key={tag} onClick={() => handleSuggestionClick(tag)}>
                                                    {tag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                                <option value="once">Once</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                            <input type="number" value={occurrences} onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)} placeholder="Occurrences" />
                        </div>
                        <textarea value={treatyMessage} onChange={(e) => setTreatyMessage(e.target.value)} placeholder="Message (optional)" className="w-full p-2 rounded border border-amber-300" rows="2"></textarea>
                        <button onClick={handleProposeTreaty} className="btn btn-confirm w-full">Propose Treaty</button>
                    </div>
                </div>
            </div>
            {message && <p className="text-sm mt-2 text-amber-800">{message}</p>}
        </div>
    );
};

export default AllianceDiplomacy;
