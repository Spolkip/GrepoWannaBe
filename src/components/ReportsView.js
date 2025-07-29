// src/components/ReportsView.js

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import unitConfig from '../gameData/units.json'; // Added import for unitConfig
import buildingConfig from '../gameData/buildings.json'; // Added import for buildingConfig

// ReportsPanel component displays a list of all active troop movements.
const ReportsView = ({ onClose }) => {
    const { currentUser } = useAuth();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);

    // Fetch reports for the current user and subscribe to real-time updates
    useEffect(() => {
        if (!currentUser) return;

        const reportsQuery = query(collection(db, 'users', currentUser.uid, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(reportsData);
        });

        return () => unsubscribe(); // Unsubscribe on component unmount
    }, [currentUser]);

    // Handle selecting a report to view its details
    const handleSelectReport = async (report) => {
        setSelectedReport(report);
        // Mark report as read if it hasn't been yet
        if (!report.read) {
            const reportRef = doc(db, 'users', currentUser.uid, 'reports', report.id);
            await updateDoc(reportRef, { read: true });
        }
    };

    // Handle deleting a report
    const handleDeleteReport = async (reportId) => {
        const reportRef = doc(db, 'users', currentUser.uid, 'reports', reportId);
        await deleteDoc(reportRef);
        // If the deleted report was currently selected, clear the selection
        if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport(null);
        }
    };

    // Renders the specific outcome details based on the report's type
     const renderReportOutcome = (report) => {
        switch (report.type) {
            case 'return':
                return (
                    <>
                        <p className="font-bold text-blue-400">Troops Returned</p>
                        <p className="text-sm text-gray-300">Surviving Units: {Object.entries(report.units || {}).map(([unit, count]) => `${count} ${unitConfig[unit]?.name || unit}`).join(', ') || 'None'}</p>
                        <p className="text-sm text-gray-300">Loot: {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                    </>
                );
            case 'attack_village': {
                const outcome = report.outcome || {};
                const attacker = report.attacker || {};
                const defender = report.defender || {};

                return (
                    <>
                        <p className={`font-bold ${outcome.attackerWon ? 'text-green-400' : 'text-red-400'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="text-sm mt-2 space-y-2">
                            <div>
                                <h4 className="font-semibold">Your Attack</h4>
                                <p>From: {attacker.cityName}</p>
                                <p>Units Sent: {Object.entries(attacker.units || {}).map(([id, count]) => `${count} ${unitConfig[id]?.name}`).join(', ')}</p>
                                <p>Losses: {Object.entries(attacker.losses || {}).map(([id, count]) => `${count} ${unitConfig[id]?.name}`).join(', ') || 'None'}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold">Village Defence</h4>
                                <p>At: {defender.villageName}</p>
                                <p>Defending Troops: {Object.entries(defender.troops || {}).map(([id, count]) => `${count} ${unitConfig[id]?.name}`).join(', ')}</p>
                                <p>Losses: {Object.entries(defender.losses || {}).map(([id, count]) => `${count} ${unitConfig[id]?.name}`).join(', ') || 'None'}</p>
                            </div>
                            {outcome.attackerWon && (
                                <p className="text-green-400">You have conquered the village!</p>
                            )}
                        </div>
                    </>
                );
            }
            case 'attack':
                const outcome = report.outcome || {};
                const survivingAttackers = outcome.survivingAttackers || {};
                const survivingDefenders = outcome.survivingDefenders || {};
                const loot = outcome.loot || {};

                return (
                    <>
                        <p className={`font-bold ${outcome.winner === 'attacker' ? 'text-green-400' : 'text-red-400'}`}>
                            {outcome.winner === 'attacker' ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="text-sm">
                            <h4 className="font-semibold mt-2">Attackers</h4>
                            <p>From: {report.originCityName}</p>
                            <p>Surviving Units: {Object.entries(survivingAttackers).map(([unit, count]) => `${count} ${unit}`).join(', ') || 'None'}</p>

                            <h4 className="font-semibold mt-2">Defenders</h4>
                            <p>At: {report.targetCityName}</p>
                            <p>Surviving Units: {Object.entries(survivingDefenders).map(([unit, count]) => `${count} ${unit}`).join(', ') || 'None'}</p>

                            {outcome.winner === 'attacker' && (
                                <>
                                    <h4 className="font-semibold mt-2">Loot</h4>
                                    <p>{Object.entries(loot).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                                </>
                            )}
                        </div>
                    </>
                );
            case 'scout':
                return (
                    <>
                        {report.scoutSucceeded ? (
                            <>
                                <p className="font-bold text-green-400">Scout Successful!</p>
                                <p className="text-sm text-gray-300">Target City: {report.targetCityName}</p>
                                <p className="text-sm text-gray-300">Owner: {report.targetOwner}</p>
                                <p className="text-sm text-gray-300">Units: {Object.entries(report.units || {}).map(([unit, count]) => `${count} ${unitConfig[unit]?.name || unit}`).join(', ') || 'None'}</p>
                                <p className="text-sm text-gray-300">Resources: {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                                <p className="text-sm text-gray-300">Buildings: {Object.entries(report.buildings || {}).map(([bldg, data]) => `${buildingConfig[bldg]?.name || bldg} (Lvl ${data.level})`).join(', ') || 'None'}</p>
                                <p className="text-sm text-gray-300">Worshipped God: {report.god || 'None'}</p>
                            </>
                        ) : (
                            <p className="font-bold text-red-400">{report.message || 'Scout Failed!'}</p>
                        )}
                    </>
                );
            case 'reinforce': //
                 return (
                    <>
                        <p className="font-bold text-blue-400">Reinforcement Arrived</p>
                        <p className="text-sm text-gray-300">From: {report.originCityName}</p>
                        <p className="text-sm text-gray-300">To: {report.targetCityName}</p>
                        <p className="text-sm text-gray-300">Units: {Object.entries(report.units || {}).map(([unit, count]) => `${count} ${unit}`).join(', ') || 'None'}</p>
                    </>
                );
            case 'trade': //
                return (
                    <>
                        <p className="font-bold text-green-400">Trade Complete</p>
                        <p className="text-sm text-gray-300">From: {report.originCityName}</p>
                        <p className="text-sm text-gray-300">To: {report.targetCityName}</p>
                        <p className="text-sm text-gray-300">Resources: {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                    </>
                );
                            case 'return':
                return (
                    <>
                        <p className="font-bold text-blue-400">Troops Returned</p>
                        <p className="text-sm text-gray-300">Surviving Units: {Object.entries(report.units || {}).map(([unit, count]) => `${count} ${unitConfig[unit]?.name || unit}`).join(', ') || 'None'}</p>
                        <p className="text-sm text-gray-300">Loot: {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                    </>
                );
            case 'spy_caught': //
                return (
                    <>
                        <p className="font-bold text-red-400">Spy Detected!</p>
                        <p className="text-sm text-gray-300">A spy from {report.originCity || 'an unknown city'} was detected.</p>
                        {report.silverGained > 0 && (
                            <p className="text-sm text-gray-300">You gained {Math.floor(report.silverGained)} silver from the spy.</p>
                        )}
                    </>
                );
            default:
                return <p>Report type not recognized.</p>;
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-gray-800 border-2 border-gray-600 rounded-lg text-white w-full max-w-4xl h-3/4 flex flex-col">
                <div className="p-4 border-b border-gray-600 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Reports</h2>
                    <button onClick={onClose} className="text-white text-2xl">&times;</button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                    {/* Reports List */}
                    <div className="w-1/3 border-r border-gray-600 overflow-y-auto">
                        <ul>
                            {reports.map(report => (
                                <li
                                    key={report.id}
                                    className={`p-3 cursor-pointer ${selectedReport && selectedReport.id === report.id ? 'bg-gray-700' : ''} ${!report.read ? 'font-bold' : ''} hover:bg-gray-700`}
                                    onClick={() => handleSelectReport(report)}
                                >
                                    <div className="flex justify-between items-center">
                                        <span>{report.title || 'Untitled Report'}</span>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }} className="text-red-500 hover:text-red-400 text-xs">Delete</button>
                                    </div>
                                    <p className="text-xs text-gray-400">{new Date(report.timestamp?.toDate()).toLocaleString()}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Report Details */}
                    <div className="w-2/3 p-4 overflow-y-auto">
                        {selectedReport ? (
                            <div>
                                <h3 className="text-lg font-bold mb-2">{selectedReport.title || 'Report Details'}</h3>
                                <div className="space-y-2">
                                    {renderReportOutcome(selectedReport)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-400">Select a report to view its details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;