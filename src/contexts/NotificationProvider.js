// src/contexts/NotificationProvider.js
import React, { useState, useCallback } from 'react';
import NotificationContext from './NotificationContext';
import Notification from '../components/shared/Notification';
import { v4 as uuidv4 } from 'uuid';

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((message) => {
        const id = uuidv4();
        setNotifications(prev => [...prev, { id, message }]);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}
            <div className="fixed bottom-5 right-5 z-[100]">
                {notifications.map(notification => (
                    <Notification
                        key={notification.id}
                        message={notification.message}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
