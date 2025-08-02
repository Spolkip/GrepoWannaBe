import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';

const AllianceSettings = ({ alliance, onClose, updateSettings, isLeader }) => {
    const { updateAllianceSettings } = useGame();
    const [name, setName] = useState(alliance.name);
    const [description, setDescription] = useState(alliance.settings.description);
    const [status, setStatus] = useState(alliance.settings.status);
    const [message, setMessage] = useState('');

    const handleSave = () => {
        if (!isLeader) return;
        if (name.trim() === '' || description.trim() === '') {
            setMessage('Name and description cannot be empty.');
            return;
        }

        updateAllianceSettings({
            name,
            description,
            status,
        });
        setMessage('Settings saved!');
    };

    return (
        <div className="p-4">
            <h3 className="text-xl font-bold mb-4">Alliance Settings</h3>
            {!isLeader && <p className="text-red-400 mb-4">You do not have permission to edit settings.</p>}
            <div className="space-y-4">
                <div>
                    <label className="block font-semibold mb-1">Alliance Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alliance Name"
                        className="w-full bg-gray-900 p-2 rounded"
                        disabled={!isLeader}
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-1">Alliance Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Alliance Description"
                        className="w-full h-24 bg-gray-900 p-2 rounded resize-none"
                        disabled={!isLeader}
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-1">Alliance Status</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-gray-900 p-2 rounded"
                        disabled={!isLeader}
                    >
                        <option value="open">Open (Anyone can join)</option>
                        <option value="invite_only">Invite Only (Join by invite or application)</option>
                        <option value="closed">Closed (Join by invite only)</option>
                    </select>
                </div>
                {isLeader && (
                    <div className="flex justify-end gap-2">
                        <button onClick={handleSave} className="btn btn-confirm">Save Settings</button>
                    </div>
                )}
                {message && <p className="text-green-400 mt-2 text-sm">{message}</p>}
            </div>
        </div>
    );
};

export default AllianceSettings;
