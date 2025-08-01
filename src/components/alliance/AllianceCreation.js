// src/components/alliance/AllianceCreation.js
import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';

const AllianceCreation = ({ onClose }) => {
    const { createAlliance } = useGame();
    const [name, setName] = useState('');
    const [tag, setTag] = useState('');

    const handleCreate = () => {
        if (name.trim() && tag.trim()) {
            createAlliance(name.trim(), tag.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold mb-2">Create an Alliance</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alliance Name"
                        className="w-full bg-gray-900 p-2 rounded"
                    />
                    <input
                        type="text"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        placeholder="Alliance Tag (e.g., ABC)"
                        maxLength="5"
                        className="w-full bg-gray-900 p-2 rounded"
                    />
                    <button onClick={handleCreate} className="btn btn-confirm">Create Alliance</button>
                </div>
            </div>
        </div>
    );
};

export default AllianceCreation;
