// src/components/ReportsView.js

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';

const ReportsView = ({ onClose }) => {
    const { currentUser } = useAuth();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [activeTab, setActiveTab] = useState('Combat');

    const tabs = {
        'Combat': ['attack', 'attack_village'],
        'Reinforce': ['reinforce'],
        'Trade': ['trade'],
        'Scout': ['scout', 'spy_caught'],
        'Misc': ['return'],
    };

    useEffect(() => {
        if (!currentUser) return;
        const reportsQuery = query(collection(db, 'users', currentUser.uid, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(reportsData);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const handleSelectReport = async (report) => {
        setSelectedReport(report);
        if (!report.read) {
            const reportRef = doc(db, 'users', currentUser.uid, 'reports', report.id);
            await updateDoc(reportRef, { read: true });
        }
    };

    const handleDeleteReport = async (reportId) => {
        const reportRef = doc(db, 'users', currentUser.uid, 'reports', reportId);
        await deleteDoc(reportRef);
        if (selectedReport && selectedReport.id === reportId) {
            setSelectedReport(null);
        }
    };

    const handleTabClick = (tabName) => {
        setActiveTab(tabName);
        setSelectedReport(null); // Clear selected report when changing tabs
    };
    
    const getReportTitleColor = (report) => {
        switch (report.type) {
            case 'attack':
            case 'attack_village':
                return report.outcome?.attackerWon ? 'text-green-400' : 'text-red-400';
            case 'scout':
                return report.scoutSucceeded ? 'text-green-400' : 'text-red-400';
            case 'spy_caught':
                return 'text-red-400';
            case 'return':
            case 'reinforce':
                return 'text-blue-400';
            case 'trade':
                return 'text-yellow-400';
            default:
                return 'text-gray-300';
        }
    };

    const getReportTitle = (report) => {
        let title = report.title || 'Untitled Report';
        if (report.type === 'attack' || report.type === 'attack_village') {
            title += report.outcome?.attackerWon ? ' (Victory)' : ' (Defeat)';
        }
        return title;
    };

    const renderUnitList = (units) => {
        if (!units || Object.keys(units).length === 0) return 'None';
        return Object.entries(units)
            .map(([id, count]) => `${count} ${unitConfig[id]?.name || id}`)
            .join(', ');
    };

    const renderReportOutcome = (report) => {
        const outcome = report.outcome || {};
        const attacker = report.attacker || {};
        const defender = report.defender || {};

        switch (report.type) {
            case 'attack':
                const survivingAttackers = {};
                for (const unitId in attacker.units) {
                    const survived = (attacker.units[unitId] || 0) - (outcome.attackerLosses?.[unitId] || 0);
                    if (survived > 0) survivingAttackers[unitId] = survived;
                }

                const survivingDefenders = {};
                for (const unitId in defender.units) {
                    const survived = (defender.units[unitId] || 0) - (outcome.defenderLosses?.[unitId] || 0);
                    if (survived > 0) survivingDefenders[unitId] = survived;
                }

                return (
                    <>
                        <p className={`font-bold text-2xl mb-4 ${outcome.attackerWon ? 'text-green-400' : 'text-red-400'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="space-y-4 text-sm">
                            <div className="p-2 bg-gray-700/50 rounded">
                                <h4 className="font-semibold text-lg text-yellow-300">Attacker: {attacker.cityName}</h4>
                                <p><strong>Units Sent:</strong> {renderUnitList(attacker.units)}</p>
                                <p><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                                <p><strong>Survivors:</strong> {renderUnitList(survivingAttackers)}</p>
                            </div>
                            <div className="p-2 bg-gray-700/50 rounded">
                                <h4 className="font-semibold text-lg text-yellow-300">Defender: {defender.cityName}</h4>
                                <p><strong>Units:</strong> {renderUnitList(defender.units)}</p>
                                <p><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                                <p><strong>Survivors:</strong> {renderUnitList(survivingDefenders)}</p>
                            </div>
                            {outcome.attackerWon && outcome.plunder && (
                                <div className="p-2 bg-green-800/30 rounded">
                                    <h4 className="font-semibold text-lg text-green-300">Loot</h4>
                                    <p>{Object.entries(outcome.plunder).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                                </div>
                            )}
                        </div>
                    </>
                );

            case 'attack_village':
                return (
                    <>
                        <p className={`font-bold ${outcome.attackerWon ? 'text-green-400' : 'text-red-400'}`}>
                            {outcome.attackerWon ? 'Victory!' : 'Defeat!'}
                        </p>
                        <div className="text-sm mt-2 space-y-2">
                             <div className="p-2 bg-gray-700/50 rounded">
                                <h4 className="font-semibold text-lg text-yellow-300">Your Attack on {defender.villageName}</h4>
                                <p><strong>Units Sent:</strong> {renderUnitList(attacker.units)}</p>
                                <p><strong>Losses:</strong> {renderUnitList(outcome.attackerLosses)}</p>
                            </div>
                             <div className="p-2 bg-gray-700/50 rounded">
                                <h4 className="font-semibold text-lg text-yellow-300">Village Defence</h4>
                                <p><strong>Defending Troops:</strong> {renderUnitList(defender.troops)}</p>
                                <p><strong>Losses:</strong> {renderUnitList(outcome.defenderLosses)}</p>
                            </div>
                            {outcome.attackerWon && (
                                <p className="text-green-400 font-bold">You have conquered the village!</p>
                            )}
                        </div>
                    </>
                );

            case 'scout':
                return (
                    <>
                        {report.scoutSucceeded ? (
                            <div className="space-y-1">
                                <p className="font-bold text-green-400">Scout Successful!</p>
                                <p><strong>Target:</strong> {report.targetCityName} (Owner: {report.targetOwnerUsername})</p>
                                <p><strong>Worshipped God:</strong> {report.god || 'None'}</p>
                                <p><strong>Units:</strong> {renderUnitList(report.units)}</p>
                                <p><strong>Resources:</strong> {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                                <p><strong>Buildings:</strong> {Object.entries(report.buildings || {}).map(([bldg, data]) => `${buildingConfig[bldg]?.name || bldg} (Lvl ${data.level})`).join(', ') || 'None'}</p>
                            </div>
                        ) : (
                            <p className="font-bold text-red-400">{report.message || 'Scout Failed!'}</p>
                        )}
                    </>
                );
            
            case 'return':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-blue-400">Troops Returned</p>
                        <p><strong>Surviving Units:</strong> {renderUnitList(report.units)}</p>
                        <p><strong>Loot:</strong> {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                    </div>
                );

            case 'spy_caught':
                return (
                     <div className="space-y-1">
                        <p className="font-bold text-red-400">Spy Detected!</p>
                        <p>A spy from {report.originCityName || 'an unknown city'} was detected.</p>
                        {report.silverGained > 0 && (
                            <p>You gained {Math.floor(report.silverGained)} silver from the spy.</p>
                        )}
                    </div>
                );
            
            case 'reinforce':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-blue-400">Reinforcement Arrived</p>
                        <p><strong>From:</strong> {report.originCityName}</p>
                        <p><strong>To:</strong> {report.targetCityName}</p>
                        <p><strong>Units:</strong> {renderUnitList(report.units)}</p>
                    </div>
                );

            case 'trade':
                return (
                    <div className="space-y-1">
                        <p className="font-bold text-yellow-400">Trade Complete</p>
                        <p><strong>From:</strong> {report.originCityName}</p>
                        <p><strong>To:</strong> {report.targetCityName}</p>
                        <p><strong>Resources:</strong> {Object.entries(report.resources || {}).map(([res, amount]) => `${Math.floor(amount)} ${res}`).join(', ') || 'None'}</p>
                    </div>
                );

            default:
                return <p>Report type not recognized.</p>;
        }
    };

    const filteredReports = reports.filter(report => tabs[activeTab]?.includes(report.type));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-gray-800 border-2 border-gray-600 rounded-lg text-white w-full max-w-4xl h-3/4 flex flex-col">
                <div className="p-4 border-b border-gray-600 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Reports</h2>
                    <button onClick={onClose} className="text-white text-2xl">&times;</button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                    <div className="w-1/3 border-r border-gray-600 flex flex-col">
                        <div className="flex border-b border-gray-600">
                            {Object.keys(tabs).map(tabName => (
                                <button
                                    key={tabName}
                                    onClick={() => handleTabClick(tabName)}
                                    className={`flex-1 p-2 text-sm font-bold transition-colors ${
                                        activeTab === tabName
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                                >
                                    {tabName}
                                </button>
                            ))}
                        </div>
                        
                        <ul className="overflow-y-auto">
                            {filteredReports.length > 0 ? (
                                filteredReports.map(report => (
                                    <li
                                        key={report.id}
                                        className={`p-3 cursor-pointer border-l-4 ${selectedReport && selectedReport.id === report.id ? 'bg-gray-700 border-yellow-400' : 'border-transparent'} ${!report.read ? 'font-bold' : ''} hover:bg-gray-700`}
                                        onClick={() => handleSelectReport(report)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`truncate pr-2 ${getReportTitleColor(report)}`}>
                                                {getReportTitle(report)}
                                            </span>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }} className="text-red-500 hover:text-red-400 text-xs flex-shrink-0">Delete</button>
                                        </div>
                                        <p className="text-xs text-gray-400">{report.timestamp?.toDate().toLocaleString()}</p>
                                    </li>
                                ))
                            ) : (
                                <p className="p-4 text-center text-gray-500">No reports in this category.</p>
                            )}
                        </ul>
                    </div>
                    
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