// src/components/alliance/AllianceBank.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AllianceBank = () => {
    const { playerAlliance, donateToBank, distributeFromBank } = useAlliance();
    const { currentUser } = useAuth();
    const { gameState, worldId } = useGame(); // To get current city resources
    const [donation, setDonation] = useState({ wood: 0, stone: 0, silver: 0 });
    const [distribution, setDistribution] = useState({ wood: 0, stone: 0, silver: 0 });
    const [targetMember, setTargetMember] = useState('');
    const [logs, setLogs] = useState([]);
    const [message, setMessage] = useState('');

    const bank = playerAlliance.bank || { wood: 0, stone: 0, silver: 0 };

    const memberRankData = useMemo(() => {
        if (!playerAlliance || !currentUser) return null;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        if (!member) return null;
        return playerAlliance.ranks.find(r => r.id === member.rank);
    }, [playerAlliance, currentUser]);

    const canManageBank = memberRankData?.permissions?.manageBank;

    useEffect(() => {
        if (!playerAlliance || !worldId) return;
        const logsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'bank_logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [playerAlliance, worldId]);

    const handleDonationChange = (e) => {
        const { name, value } = e.target;
        const amount = Math.max(0, Math.min(gameState.resources[name] || 0, parseInt(value) || 0));
        setDonation(prev => ({ ...prev, [name]: amount }));
    };

    const handleDistributionChange = (e) => {
        const { name, value } = e.target;
        const amount = Math.max(0, Math.min(bank[name] || 0, parseInt(value) || 0));
        setDistribution(prev => ({ ...prev, [name]: amount }));
    };

    const handleDonate = async () => {
        setMessage('');
        try {
            await donateToBank(donation);
            setMessage('Donation successful!');
            setDonation({ wood: 0, stone: 0, silver: 0 });
        } catch (error) {
            setMessage(`Donation failed: ${error.message}`);
        }
    };

    const handleDistribute = async () => {
        setMessage('');
        if (!targetMember) {
            setMessage('Please select a member to distribute resources to.');
            return;
        }
        try {
            await distributeFromBank(targetMember, distribution);
            setMessage('Distribution successful!');
            setDistribution({ wood: 0, stone: 0, silver: 0 });
            setTargetMember('');
        } catch (error) {
            setMessage(`Distribution failed: ${error.message}`);
        }
    };

    const membersForDropdown = playerAlliance.members.filter(m => m.uid !== currentUser.uid);

    return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4 border-b border-amber-300 pb-2">Alliance Bank</h3>
            {message && <p className="text-center text-amber-800 mb-4">{message}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bank Holdings */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-lg mb-2">Bank Holdings</h4>
                    <p>Wood: {bank.wood.toLocaleString()}</p>
                    <p>Stone: {bank.stone.toLocaleString()}</p>
                    <p>Silver: {bank.silver.toLocaleString()}</p>
                </div>

                {/* Donation Form */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-lg mb-2">Donate Resources</h4>
                    <div className="space-y-2">
                        <div>
                            <label>Wood (Your: {Math.floor(gameState.resources.wood)})</label>
                            <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full p-1 rounded border border-amber-300" />
                        </div>
                        <div>
                            <label>Stone (Your: {Math.floor(gameState.resources.stone)})</label>
                            <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full p-1 rounded border border-amber-300" />
                        </div>
                        <div>
                            <label>Silver (Your: {Math.floor(gameState.resources.silver)})</label>
                            <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full p-1 rounded border border-amber-300" />
                        </div>
                        <button onClick={handleDonate} className="btn btn-confirm w-full">Donate</button>
                    </div>
                </div>

                {/* Distribution Form (for authorized members) */}
                {canManageBank && (
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 md:col-span-2">
                        <h4 className="font-bold text-lg mb-2">Distribute Resources</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label>Member</label>
                                <select value={targetMember} onChange={(e) => setTargetMember(e.target.value)} className="w-full p-1 rounded border border-amber-300">
                                    <option value="">Select Member</option>
                                    {membersForDropdown.map(member => (
                                        <option key={member.uid} value={member.uid}>{member.username}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>Wood</label>
                                <input type="number" name="wood" value={distribution.wood} onChange={handleDistributionChange} className="w-full p-1 rounded border border-amber-300" />
                            </div>
                            <div>
                                <label>Stone</label>
                                <input type="number" name="stone" value={distribution.stone} onChange={handleDistributionChange} className="w-full p-1 rounded border border-amber-300" />
                            </div>
                            <div>
                                <label>Silver</label>
                                <input type="number" name="silver" value={distribution.silver} onChange={handleDistributionChange} className="w-full p-1 rounded border border-amber-300" />
                            </div>
                        </div>
                        <button onClick={handleDistribute} className="btn btn-primary w-full mt-4">Distribute</button>
                    </div>
                )}

                {/* Transaction Logs */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 md:col-span-2">
                    <h4 className="font-bold text-lg mb-2">Transaction History</h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {logs.map(log => (
                            <li key={log.id} className="text-sm p-2 bg-white rounded border border-amber-200">
                                {log.type === 'donation' ? (
                                    <span><strong>{log.user}</strong> donated {Object.entries(log.resources).map(([r,a]) => `${a} ${r}`).join(', ')}.</span>
                                ) : (
                                    <span><strong>{log.from}</strong> sent {Object.entries(log.resources).map(([r,a]) => `${a} ${r}`).join(', ')} to <strong>{log.to}</strong>.</span>
                                )}
                                <span className="text-xs text-gray-500 float-right">{log.timestamp?.toDate().toLocaleTimeString()}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AllianceBank;
