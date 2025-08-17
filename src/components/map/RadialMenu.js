// src/components/map/RadialMenu.js
import React, { useState } from 'react';
import './RadialMenu.css';

const RadialMenu = ({ actions, onClose }) => {
    // #comment State to track which menu item is currently hovered/active
    const [activeIndex, setActiveIndex] = useState(null);
    const radius = 100;
    const angleStep = (2 * Math.PI) / actions.length;

    return (
        <div className="radial-menu-overlay" onClick={onClose}>
            <div className="radial-menu-container">
                {actions.map((action, index) => {
                    const angle = index * angleStep - Math.PI / 2;
                    // Initial position on the circle
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);

                    return (
                        <button
                            key={index}
                            // #comment Apply 'active' class when this item is hovered
                            className={`radial-menu-item ${activeIndex === index ? 'active' : ''}`}
                            // #comment The transform is applied via inline style, which is overridden by the .active class in CSS
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                            // #comment Set this item as active on hover
                            onMouseEnter={() => setActiveIndex(index)}
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
