// src/components/shared/Notification.js
import React, { useEffect, useState, useCallback } from 'react';
import './Notification.css';
import archerIcon from '../../images/troops/archers.png'; 

const Notification = ({ message, onClose }) => {
    const [visible, setVisible] = useState(true);

    const handleClose = useCallback(() => {
        setVisible(false);
        // Allow time for fade-out animation before calling onClose
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, 5000); // Notification disappears after 5 seconds

        return () => clearTimeout(timer);
    }, [handleClose]);

    return (
        <div className={`notification-container ${visible ? 'show' : ''}`}>
            <div className="notification-content">
                <p>{message}</p>
            </div>
            <div className="notification-icon-container">
                <img src={archerIcon} alt="Notification Icon" className="notification-icon" />
            </div>
            <button onClick={handleClose} className="notification-close-btn">&times;</button>
        </div>
    );
};

export default Notification;
