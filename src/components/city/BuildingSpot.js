import React from 'react';

const BuildingSpot = ({ building, level, onClick, image }) => {
    const { id, name, position } = building;

    const isCityWall = id === 'city_wall';

    // Define styles based on whether it's the city wall or not
    const spotStyle = {
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: isCityWall ? '2000px' : '150px',
        height: isCityWall ? '100px' : '100px', // Adjusted height for better image display
        backgroundImage: level > 0 && image ? `url(${image})` : 'none',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
    };

    if (level === 0) {
        return (
             <div
                className="building-spot absolute flex items-center justify-center p-2 rounded-lg cursor-pointer border-dashed border-gray-400/50 hover:border-yellow-400 hover:bg-black/20" // Removed border-2
                style={spotStyle}
                onClick={onClick}
                title={`Build ${name}`}
            >
                <span className="text-gray-400 text-sm">
                    {isCityWall ? `Build ${name}` : 'Empty Plot'}
                </span>
            </div>
        );
    }

    return (
        <div
            className="building-spot absolute flex flex-col items-center justify-center p-2 rounded-lg shadow-lg hover:bg-yellow-400/30 transition-colors duration-200 cursor-pointer" // Removed border-2 and border-yellow-600/50
            style={{
                ...spotStyle,
                backgroundColor: isCityWall ? 'rgba(100, 80, 60, 0.7)' : (image ? 'transparent' : 'rgba(139, 69, 19, 0.7)'),
            }}
            onClick={onClick}
        >
        </div>
    );
};

export default BuildingSpot;
