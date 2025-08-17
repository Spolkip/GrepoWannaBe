// src/components/map/RadialMenu.js
import React, { useState } from 'react';
import './RadialMenu.css';

const RadialMenu = ({ actions, position, onClose }) => {
    const [activeIndex, setActiveIndex] = useState(null);
    const radius = 100;
    const angleStep = (2 * Math.PI) / actions.length;

    if (!position) {
        return null;
    }

    // #comment This handler will reset the active item when the mouse leaves the central area of the menu.
    const handleMouseLeaveContainer = () => {
        setActiveIndex(null);
    };

    return (
        <div className="radial-menu-overlay" onClick={onClose}>
            <div
                className="radial-menu-container"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                }}
                onClick={e => e.stopPropagation()}
                // #comment The onMouseLeave is now on the container.
                onMouseLeave={handleMouseLeaveContainer}
            >
                {actions.map((action, index) => {
                    const angle = index * angleStep - Math.PI / 2;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);

                    return (
                        <button
                            key={index}
                            className={`radial-menu-item ${activeIndex === index ? 'active' : ''}`}
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                            onMouseEnter={() => setActiveIndex(index)}
                            // onMouseLeave is removed from individual items to prevent flickering
                            onClick={(e) => {
                                e.stopPropagation();
                                action.handler();
                                onClose();
                            }}
                            title={action.label}
                        >
                            <span className="radial-menu-icon-wrapper">
                                <span className="radial-menu-icon">{action.icon}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RadialMenu;
