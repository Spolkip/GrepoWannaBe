import React from 'react';
import Countdown from './Countdown'; // Import Countdown component
import unitConfig from '../../gameData/units.json'; // Import unit configuration

// MovementItem component displays details of a single troop movement.
const MovementItem = ({ movement, citySlots, onRush, isAdmin }) => {
    // Destructure currentUser from useAuth, assuming it's available in the parent context
    // For this standalone component, we'll assume currentUser is passed as a prop for simplicity
    // or fetched from a context within this component if it were truly standalone.
    // For now, let's assume it's passed from MapView.
    const currentUser = movement.originOwnerId; // Simplified for display, actual check is in parent

    const originCity = citySlots[movement.originCityId];
    const targetCity = citySlots[movement.targetCityId];
    const isOutgoing = movement.originOwnerId === currentUser; // Determine if movement is outgoing for current user

    // Helper function to render details of units and resources involved in the movement
    const renderDetails = () => {
        let details = [];
        if (movement.units) {
            const units = Object.entries(movement.units).filter(([, count]) => count > 0);
            if (units.length > 0) {
                details.push(units.map(([id, count]) => `${count} ${unitConfig[id].name}`).join(', '));
            }
        }
        if (movement.resources) {
            const resources = Object.entries(movement.resources).filter(([, amount]) => amount > 0);
             if (resources.length > 0) {
                details.push(resources.map(([id, amount]) => `${amount} ${id}`).join(', '));
            }
        }
        return details.join(' & ');
    };
    
    // Determine the "from" and "to" cities based on movement status (moving or returning)
    const fromCity = movement.status === 'returning' ? targetCity : originCity;
    const toCity = movement.status === 'returning' ? originCity : targetCity;
    // Determine the action text (e.g., "Attack", "Reinforce", "Returning")
    const actionText = movement.status === 'returning' ? 'Returning' : movement.type;

    return (
        <div className={`bg-gray-700 p-4 rounded-lg border-l-4 ${isOutgoing ? 'border-red-500' : 'border-green-500'}`}>
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-bold text-lg text-white capitalize">{actionText}</p>
                    <p className="text-sm text-gray-400">
                        From: {fromCity?.cityName || 'Unknown'} To: {toCity?.cityName || 'Unknown'}
                    </p>
                </div>
                <div className="text-right">
                    {/* Display countdown to arrival time */}
                    <p className="text-white font-bold"><Countdown arrivalTime={movement.arrivalTime} /></p>
                    <p className="text-xs text-gray-400">Arrival</p>
                </div>
            </div>
            <p className="text-sm text-gray-300 mt-2">{renderDetails()}</p>
            {/* Admin "Rush" button, visible only to admins */}
            {isAdmin && (
                <button onClick={() => onRush(movement.id)} className="btn btn-primary text-xs px-2 py-1 mt-2">Rush</button>
            )}
        </div>
    );
};

export default MovementItem;
