import { createContext, useContext } from 'react';

// This context has been refactored.
// The provider logic is now in AllianceProvider.js
// The action logic has been split into multiple hooks in src/hooks/actions/
// This file now only defines the context itself.

const AllianceContext = createContext();

export const useAlliance = () => {
    const context = useContext(AllianceContext);
    if (context === undefined) {
        throw new Error('useAlliance must be used within an AllianceProvider');
    }
    return context;
};

export default AllianceContext;
